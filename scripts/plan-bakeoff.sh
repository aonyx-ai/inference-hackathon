#!/usr/bin/env bash
#
# plan-bakeoff.sh — execute two implementation plans head-to-head and report
# which one Claude Code executes better, faster, and cheaper.
#
# Each plan is run k times from the SAME base commit, each run in its own
# throwaway git worktree so the arms never contaminate each other. For every
# run we record whether an oracle command passes, plus wall-clock time, token
# cost, and diff size pulled straight from `claude -p`'s JSON output. The only
# thing that varies between the two arms is the plan text — same base, same
# model, same oracle — so the comparison isolates plan quality.
#
# Usage:
#   scripts/plan-bakeoff.sh \
#     --plan-a plans/claude-plan.md   --label-a "/plan mode" \
#     --plan-b plans/our-tool.md      --label-b "our tool" \
#     --oracle "just test" \
#     --base HEAD --runs 5 [--model claude-sonnet-4-6]
#
# The oracle is any command; exit 0 means the run produced working code. A
# hidden test suite the executor never sees is the most credible oracle — keep
# it out of the plan text and out of the repo the agent edits if you can.
#
# Requires: git, claude, jq.

set -euo pipefail

# --- Defaults --------------------------------------------------------------

BASE="HEAD"
RUNS=5
MODEL=""
ORACLE=""
PLAN_A=""
PLAN_B=""
LABEL_A="plan-a"
LABEL_B="plan-b"
WORKDIR=".bakeoff"
# Applied identically to both arms, so it never advantages one plan format.
WRAPPER="Execute the following implementation plan in this repository. Make all the code changes it calls for, end to end."

usage() { sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# --- Args ------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan-a)  PLAN_A="$2"; shift 2 ;;
    --plan-b)  PLAN_B="$2"; shift 2 ;;
    --label-a) LABEL_A="$2"; shift 2 ;;
    --label-b) LABEL_B="$2"; shift 2 ;;
    --oracle)  ORACLE="$2"; shift 2 ;;
    --base)    BASE="$2"; shift 2 ;;
    --runs)    RUNS="$2"; shift 2 ;;
    --model)   MODEL="$2"; shift 2 ;;
    --workdir) WORKDIR="$2"; shift 2 ;;
    --wrapper) WRAPPER="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "unknown flag: $1" >&2; usage 1 ;;
  esac
done

# --- Preflight -------------------------------------------------------------

for bin in git claude jq; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done
[[ -n "$PLAN_A" && -f "$PLAN_A" ]] || { echo "--plan-a must be an existing file" >&2; exit 1; }
[[ -n "$PLAN_B" && -f "$PLAN_B" ]] || { echo "--plan-b must be an existing file" >&2; exit 1; }
[[ -n "$ORACLE" ]] || { echo "--oracle is required (a command; exit 0 = pass)" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE_SHA="$(git rev-parse --verify "$BASE")"
MODEL_FLAG=(); [[ -n "$MODEL" ]] && MODEL_FLAG=(--model "$MODEL")

mkdir -p "$WORKDIR"
RESULTS="$WORKDIR/results.tsv"
printf 'arm\trun\tpass\tduration_s\tcost_usd\tin_tok\tout_tok\tdiff_lines\tturns\terror\n' > "$RESULTS"

echo "Base:   $BASE_SHA"
echo "Runs:   $RUNS per arm"
echo "Model:  ${MODEL:-<default>}"
echo "Oracle: $ORACLE"
echo

# --- One run ---------------------------------------------------------------
# Spin up a fresh worktree at the base commit, let Claude Code execute the
# plan headlessly, then score the result and tear the worktree down.

run_one() {
  local arm="$1" label="$2" plan_file="$3" run_idx="$4"
  local wt="$WORKDIR/wt-${arm}-${run_idx}"
  local out_json="$WORKDIR/${arm}-${run_idx}.json"

  git -C "$REPO_ROOT" worktree add --quiet --detach "$wt" "$BASE_SHA"

  local prompt; prompt="$WRAPPER"$'\n\n'"$(cat "$plan_file")"

  # --dangerously-skip-permissions: the worktree is a disposable copy, so we
  # trade the prompts for unattended execution. Run this on a sandbox, not a
  # machine you care about.
  local err=0
  ( cd "$wt" && claude -p "$prompt" \
      --output-format json \
      --dangerously-skip-permissions \
      ${MODEL_FLAG[@]+"${MODEL_FLAG[@]}"} ) > "$out_json" 2>"$WORKDIR/${arm}-${run_idx}.err" || err=1

  local duration cost in_tok out_tok turns is_err
  duration=$(jq -r '(.duration_ms // 0) / 1000' "$out_json" 2>/dev/null || echo 0)
  cost=$(jq    -r '.total_cost_usd // 0'        "$out_json" 2>/dev/null || echo 0)
  in_tok=$(jq  -r '.usage.input_tokens // 0'    "$out_json" 2>/dev/null || echo 0)
  out_tok=$(jq -r '.usage.output_tokens // 0'   "$out_json" 2>/dev/null || echo 0)
  turns=$(jq   -r '.num_turns // 0'             "$out_json" 2>/dev/null || echo 0)
  # NB: jq's `//` treats false as empty, so `.is_error // true` would report
  # true on every successful run. Test the value explicitly instead.
  is_err=$(jq  -r 'if .is_error == true then 1 else 0 end' "$out_json" 2>/dev/null || echo 1)
  [[ "$is_err" == "1" ]] && err=1

  # Diff size as a proxy for how much the plan moved: staged add+delete lines,
  # including new files.
  git -C "$wt" add -A
  local diff_lines
  diff_lines=$(git -C "$wt" diff --cached --numstat \
    | awk '{a+=$1; d+=$2} END {print a+d+0}')

  # Oracle runs against the edited working tree. 0 = the plan produced code
  # that works.
  local pass=0
  if ( cd "$wt" && eval "$ORACLE" ) >"$WORKDIR/${arm}-${run_idx}.oracle.log" 2>&1; then
    pass=1
  fi

  printf '%s\t%d\t%d\t%.1f\t%.4f\t%d\t%d\t%d\t%d\t%d\n' \
    "$label" "$run_idx" "$pass" "$duration" "$cost" \
    "$in_tok" "$out_tok" "$diff_lines" "$turns" "$err" >> "$RESULTS"

  printf '  %-14s run %s: %s  %.0fs  $%.3f  %s lines\n' \
    "$label" "$run_idx" \
    "$([[ $pass == 1 ]] && echo PASS || echo fail)" \
    "$duration" "$cost" "$diff_lines"

  git -C "$REPO_ROOT" worktree remove --force "$wt"
}

# --- Main loop -------------------------------------------------------------
# Interleave the arms (A, B, A, B, ...) so neither gets a systematically
# busier or quieter machine.

for i in $(seq 1 "$RUNS"); do
  echo "Run $i/$RUNS"
  run_one a "$LABEL_A" "$PLAN_A" "$i"
  run_one b "$LABEL_B" "$PLAN_B" "$i"
done

# --- Summary ---------------------------------------------------------------

echo
echo "=== Summary ($RUNS runs per arm) ==="
awk -F'\t' '
  NR == 1 { next }
  {
    arm[$1]=1; n[$1]++; pass[$1]+=$3;
    dur[$1]+=$4; cost[$1]+=$5; out[$1]+=$7; diff[$1]+=$8;
  }
  END {
    printf "%-16s %8s %10s %10s %12s %10s\n", \
      "arm", "pass", "passrate", "mean_s", "mean_cost", "mean_out_tok";
    for (a in arm)
      printf "%-16s %6d/%-1d %9.0f%% %10.0f %11.4f$ %10.0f\n", \
        a, pass[a], n[a], 100*pass[a]/n[a], dur[a]/n[a], cost[a]/n[a], out[a]/n[a];
  }
' "$RESULTS"

echo
echo "Per-run detail: $RESULTS"
echo "Transcripts:    $WORKDIR/<arm>-<run>.json"
