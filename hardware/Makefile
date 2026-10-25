VERILATOR ?= verilator
CXX ?= c++
RTL := rtl/risk_accelerator.sv
TB := tb/tb_risk_accelerator.cpp
OBJ_DIR := build/obj_dir
BIN := $(OBJ_DIR)/Vrisk_accelerator
TRACE ?= risk_accelerator.vcd
ALERTS ?= alerts.jsonl

.PHONY: all run clean lint synth
all: $(BIN)

$(BIN): $(RTL) $(TB)
	mkdir -p build
	$(VERILATOR) --cc --exe --build --trace --top-module risk_accelerator \
		-Wall -Wno-fatal -Wno-WIDTHEXPAND --Mdir $(OBJ_DIR) -CFLAGS "-std=c++17 -O2" \
		$(abspath $(RTL)) $(abspath $(TB))

run: $(BIN)
	./$(BIN) $(TRACE) $(ALERTS)

# --- Yosys Synthesis & Resource Reporting ---
synth:
	@mkdir -p build
	yosys -p "read_verilog -sv $(abspath rtl/risk_accelerator.sv); synth -top risk_accelerator; tee -o build/synth_report.txt stat"
	@echo "Synthesis complete. Report saved to hardware/build/synth_report.txt"

lint:
	$(VERILATOR) --lint-only --top-module risk_accelerator -Wall -Wno-fatal $(abspath $(RTL))

clean:
	rm -rf build $(TRACE) $(ALERTS)
