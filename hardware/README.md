# ApexGate Hardware Fast-Path RTL

This directory contains a synthesizable two-stage AXI4-Stream pre-trade risk classifier, a synchronous slow-path alert FIFO, and a Verilator C++ driver. The block accepts one transaction per clock when `s_axis_tvalid && s_axis_tready` is true. Risk decisions are emitted on the fast-path outputs and risky transactions are queued for host retrieval.

This is an RTL and simulation prototype. The testbench alert export can be relayed to the Python investigation endpoint; the RTL is not deployed on a physical FPGA, and there is no hardware transport driver in this repository.

## AXI-Stream input

The slave interface uses `s_axis_aclk`, active-low `s_axis_aresetn`, `s_axis_tvalid`, `s_axis_tready`, and an 80-bit `s_axis_tdata`. The packed data layout is:

| Bits | Field |
| --- | --- |
| `[79:48]` | Unsigned amount, in application-defined integer ticks |
| `[47:32]` | Unsigned velocity count |
| `[31:0]` | Source wallet ID |

A transfer occurs only on a rising edge where `s_axis_tvalid && s_axis_tready` is high. The source must hold `tvalid` and `tdata` stable until that handshake. `s_axis_tready` is low during reset and whenever the alert FIFO plus in-flight pipeline reservations have no remaining capacity.

## Fast-path policy and latency

The two pipeline stages perform parallel strict threshold comparisons and register the reason-coded result. Parameters set the amount limit, velocity limit, exact watched wallet ID, and FIFO depth. Defaults are `1,000,000`, `100`, `32'hDEAD_BEEF`, and 16 entries. Equality with a numeric limit is allowed.

`valid_out` qualifies `risk_flag` and `status_code`. The status bitmap is bit 0 for amount over limit, bit 1 for velocity over limit, bit 2 for an exact watched-ID match, and bit 3 reserved at zero. Each accepted input produces a decision two rising-edge pipeline stages later. The pipeline can sustain one accepted packet per cycle when the FIFO has capacity. The timestamp counter increments on accepted AXI transfers; its value is captured with the packet at ingress.

## Slow-path alert FIFO

Each `risk_flag` decision automatically enqueues the associated transaction details. The FIFO payload is 148 bits at the default 64-bit timestamp width, packed from MSB to LSB as:

```text
{timestamp[63:0], status_code[3:0], velocity[15:0], amount[31:0], wallet_id[31:0]}
```

The host-side interface is:

- `fifo_empty`: asserted when no alert is queued.
- `fifo_count`: number of queued alerts, width `$clog2(FIFO_DEPTH+1)`.
- `fifo_dout`: combinational peek of the head payload; zero when empty.
- `fifo_read_en`: consume the head on a rising edge when `fifo_read_en && !fifo_empty`.

The FIFO is synchronous to `s_axis_aclk`, matching the stream clock domain. This design does not implement clock-domain crossing; a host in another clock domain needs a proper asynchronous FIFO wrapper. Reads from an empty FIFO are ignored.

To prevent alert loss, the accelerator reserves one potential FIFO slot for every valid transaction in either pipeline stage. This deliberately assumes every in-flight packet could trigger a risk alert. Consequently, `s_axis_tready` may deassert before the physical FIFO reaches its full count, while reserved decisions are still in flight. Once the FIFO is full and the pipeline drains, the input remains backpressured until the host reads an entry. The design does not silently overwrite alerts.

## Datapath and FIFO block diagram

```text
 AXI4-Stream slave
 {amount, velocity, wallet_id}
         │ handshake
         ▼
 ┌──────────────────────────┐
 │ Stage 1: parallel checks │  capture ingress timestamp
 └─────────────┬────────────┘
               ▼
 ┌──────────────────────────┐
 │ Stage 2: registered      │── valid_out / risk_flag / status_code
 │ decision and payload     │
 └─────────────┬────────────┘
               │ risk_flag
               ▼
       ┌───────────────┐        host read_en / dout / empty / count
       │ Alert FIFO    │──────────────────────────────────────────▶
       │ parameterized │
       └───────────────┘
```

The sequential logic is two datapath stages, a timestamp counter, FIFO storage, and FIFO pointers/count. The combinational logic is the amount and velocity magnitude comparisons, wallet equality comparison, status reduction, ready-capacity calculation, and FIFO head selection. There is no multi-cycle FSM, multiplier, divider, or inferred algorithmic memory beyond the alert FIFO.

## Resource estimate

Resource use depends on synthesis target and optimization. The two pipeline stages hold approximately `2 valid + 3 stage-1 status + 4 stage-2 status + 2 * (32 amount + 16 velocity + 32 wallet + 64 timestamp) = 297` bits, plus a 64-bit timestamp counter, FIFO pointers/count, and the FIFO payload storage (`148 * FIFO_DEPTH` bits; 2,368 bits at depth 16). The original design's 12-bit estimate no longer applies after registering the full transaction details and timestamp.

The comparison logic consists of 32-bit and 16-bit unsigned magnitude comparators plus a 32-bit equality comparator. An FPGA will generally map magnitude comparisons into carry-chain/comparator logic and the equality check into XNOR/reduction logic. A depth-16 implementation has approximately 2.4 kbits of FIFO storage and may map to distributed RAM or registers depending on the FPGA and coding/synthesis settings. No post-synthesis LUT/FF/BRAM, timing, power, or clock-frequency result is claimed; run the target vendor synthesis flow to obtain those values.

## Build and run

Requirements: Verilator with tracing support, GNU Make, and a C++17 compiler.

```bash
cd hardware
make run
```

The harness checks ordinary and boundary traffic, over-limit and watched-wallet decisions, status reasons, FIFO payload contents and timestamps, full-FIFO backpressure, host draining, and resumed traffic after a read. It exports every drained alert as JSON Lines in `hardware/alerts.jsonl`, which can be consumed from the repository root by `python -m service.hardware_bridge`. A mismatch returns a non-zero exit status. The default trace is `hardware/risk_accelerator.vcd`; override the outputs with `make run TRACE=build/session.vcd ALERTS=build/alerts.jsonl`. `make lint` runs Verilator lint, `make synth` runs generic Yosys synthesis and writes `hardware/build/synth_report.txt`, and `make clean` removes generated build and output files.

## Surfer waveform inspection

```bash
surfer risk_accelerator.vcd
```

Inspect `s_axis_tvalid`, `s_axis_tready`, `s_axis_tdata`, `valid_out`, `risk_flag`, `status_code`, `fifo_count`, `fifo_empty`, `fifo_read_en`, and `fifo_dout`. Confirm that source transfers occur only on valid/ready handshakes, decisions follow the two-stage pipeline, FIFO count tracks enqueues and reads, and backpressure holds while capacity is reserved or exhausted. The harness writes VCD using Verilator tracing; no proprietary simulator is required.

## Verification scope

This is directed cycle-based simulation, not formal verification, randomized coverage closure, CDC analysis, or a replacement for FPGA synthesis and timing analysis. Yosys' generic synthesis report is not a vendor FPGA implementation result. The RTL and testbench assume a single synchronous clock and the default FIFO depth of 16. If changing packet widths, FIFO payload layout, policy parameters, depth, or pipeline stages, update the harness and this interface contract together.
