# Risk Accelerator RTL

This directory contains a small, synthesizable streaming pre-trade risk block and a Verilator C++ driver. It demonstrates a hardware fast-path interface: one transaction may be accepted on every clock, with a fixed two-register-stage decision latency. It is a policy example and simulation target; it is not connected to the Python scoring service or a physical FPGA in this repository.

## Interface and policy

`risk_accelerator` accepts an unsigned 32-bit amount in application-defined integer ticks, a 32-bit source wallet identifier, and an unsigned 16-bit count of recent transactions. Parameters set the strict amount and velocity limits and one exact watched wallet ID. The illustrative defaults are `1,000,000`, `100`, and `32'hDEAD_BEEF`.

The status vector is a reason bitmap: bit 0 means amount is strictly above its limit, bit 1 means velocity is strictly above its limit, and bit 2 means the source ID exactly matches the watched ID. Bit 3 is reserved and zero. Any set reason bit asserts `risk_flag` when `valid_out` is high. Equality with a numeric limit is allowed. This wallet match is a simple deterministic example, not a cryptographic hash or a production sanctions/watchlist implementation.

## Datapath and timing

```text
 amount ───────┐   ┌─ amount > limit ─────┐
 velocity ─────┼──▶│ parallel comparisons ├─▶ Stage 1 reason registers
 wallet ID ────┘   └─ ID == watched ID ───┘             │
                                                        ▼
                                  Stage 2 valid/reason registers
                                                        │
                                      valid_out, risk_flag, status_code
```

Stage 1 performs three independent combinational comparisons and registers their results with `valid_in`. Stage 2 registers the stage 1 valid and reason bundle. There is no multi-cycle FSM: each valid input is an independent transaction, so the design can accept one item per cycle after reset. `valid_out` is observed two rising-edge pipeline stages after the corresponding input is sampled. Reset is synchronous active-low and clears both valid bits and status registers; data fields need not be reset because validity qualifies them.

All comparisons use unsigned fixed-width vectors. The input amounts are not scaled internally, avoiding implicit decimal arithmetic and keeping threshold interpretation explicit at the integration boundary.

## Logic and resource estimate

There are no inferred memories, multipliers, dividers, or variable-latency control states. The sequential logic is two pipeline stages; the combinational logic is three magnitude/equality comparisons plus a small OR reduction. A rough RTL-derived estimate is approximately 12 state bits (1 + 3 in stage 1; 1 + 4 in stage 2), plus any tool-specific reset/enable implementation overhead. A 32-bit magnitude compare and a 16-bit magnitude compare are typically mapped to carry-chain/comparator structures on FPGA or standard-cell comparator logic on ASIC; the 32-bit equality compare maps to XNOR and reduction logic. Expect on the order of tens of LUTs on a common FPGA, but actual LUT/FF use and timing depend on the target family, synthesis constraints, and whether comparison logic is optimized. No post-synthesis area, timing, power, or clock-frequency claim is made here.

## Build and run

Requirements: Verilator with tracing support, GNU Make, and a C++17 compiler.

```bash
cd hardware
make run
```

The executable prints a PASS/FAIL line for ordinary, boundary, over-limit, watched-wallet, simultaneous-trigger, invalid, and recovery cases. A non-zero exit status indicates a mismatch. The default trace is `hardware/risk_accelerator.vcd`; override it with `make run TRACE=build/session.vcd`. `make lint` runs Verilator lint, and `make clean` removes generated build and trace artifacts.

## Waveform inspection in Surfer

Open the generated VCD in Surfer:

```bash
surfer risk_accelerator.vcd
```

Add `clk`, `rst_n`, `valid_in`, inputs, `valid_out`, `risk_flag`, and `status_code` to the waveform view. Compare each accepted input with the output two rising edges later. The testbench writes VCD using Verilator's tracing interface; no proprietary simulator is required.

## Verification scope

The C++ testbench checks representative policy cases and the pipeline's valid/status alignment while producing a trace. It is a directed simulation harness, not formal verification, randomized coverage closure, CDC analysis, or a substitute for synthesis and timing analysis. If changing the pipeline depth, policy, or interface, update the expected vectors and the stated latency together.
