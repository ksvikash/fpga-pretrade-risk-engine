#include "Vrisk_accelerator.h"
#include "verilated.h"
#include "verilated_vcd_c.h"

#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

namespace {
constexpr uint32_t kAmountLimit = 1'000'000;
constexpr uint16_t kVelocityLimit = 100;
constexpr uint32_t kWatchedWallet = 0xDEADBEEF;

struct Vector {
    const char* name;
    uint32_t amount;
    uint32_t wallet;
    uint16_t velocity;
    bool valid;
    uint8_t expected_status;
};

void tick(Vrisk_accelerator& dut, VerilatedVcdC& trace, vluint64_t& time) {
    dut.clk = 0;
    dut.eval();
    trace.dump(time++);
    dut.clk = 1;
    dut.eval();
    trace.dump(time++);
}
}  // namespace

int main(int argc, char** argv) {
    Verilated::commandArgs(argc, argv);
    Verilated::traceEverOn(true);

    Vrisk_accelerator dut;
    VerilatedVcdC trace;
    dut.trace(&trace, 99);
    const std::string trace_path = argc > 1 ? argv[1] : "risk_accelerator.vcd";
    trace.open(trace_path.c_str());
    vluint64_t time = 0;

    dut.clk = 0;
    dut.rst_n = 0;
    dut.valid_in = 0;
    dut.amount = 0;
    dut.source_wallet_id = 0;
    dut.velocity_count = 0;
    tick(dut, trace, time);
    tick(dut, trace, time);
    dut.rst_n = 1;

    const std::vector<Vector> vectors = {
        {"normal", 50'000, 0x12345678, 3, true, 0},
        {"amount-at-limit", kAmountLimit, 0x12345678, 20, true, 0},
        {"amount-over-limit", kAmountLimit + 1, 0x12345678, 20, true, 1},
        {"velocity-at-limit", 12'000, 0x12345678, kVelocityLimit, true, 0},
        {"velocity-surge", 12'000, 0x12345678, kVelocityLimit + 1, true, 2},
        {"watched-wallet", 12'000, kWatchedWallet, 2, true, 4},
        {"multiple-triggers", kAmountLimit + 4, kWatchedWallet, 500, true, 7},
        {"invalid-input", kAmountLimit + 4, kWatchedWallet, 500, false, 7},
        {"recovery", 1, 0x01020304, 0, true, 0},
    };

    // Two invalid bubbles flush the two-stage pipeline after the final vector.
    struct Expected { const char* name; bool valid; uint8_t status; };
    std::vector<Expected> expected;
    for (const auto& v : vectors) expected.push_back({v.name, v.valid, v.expected_status});
    expected.push_back({"flush-1", false, 0});
    expected.push_back({"flush-2", false, 0});

    int failures = 0;
    size_t cycle = 0;
    for (size_t i = 0; i < vectors.size() + 2; ++i) {
        const Vector* input = i < vectors.size() ? &vectors[i] : nullptr;
        dut.valid_in = input ? input->valid : 0;
        dut.amount = input ? input->amount : 0;
        dut.source_wallet_id = input ? input->wallet : 0;
        dut.velocity_count = input ? input->velocity : 0;
        tick(dut, trace, time);

        // At this point the output corresponds to the vector accepted two
        // rising edges earlier (the current vector is checked after two cycles).
        if (i >= 1) {
            const size_t out_index = i - 1;
            const auto& exp = expected[out_index];
            const bool got_valid = dut.valid_out;
            const uint8_t got_status = dut.status_code;
            const bool got_risk = dut.risk_flag;
            if (got_valid != exp.valid || got_status != (exp.valid ? exp.status : 0) ||
                got_risk != (exp.valid && exp.status != 0)) {
                std::cerr << "FAIL " << exp.name << ": valid=" << got_valid
                          << " status=0x" << std::hex << static_cast<unsigned>(got_status)
                          << " risk=" << got_risk << std::dec << '\n';
                ++failures;
            } else {
                std::cout << "PASS " << exp.name << '\n';
            }
            ++cycle;
        }
    }

    // One extra cycle exposes the last queued expected sample.
    dut.valid_in = 0;
    dut.amount = 0;
    dut.source_wallet_id = 0;
    dut.velocity_count = 0;
    tick(dut, trace, time);
    const auto& exp = expected.back();
    if (dut.valid_out != exp.valid || dut.status_code != 0 || dut.risk_flag) {
        std::cerr << "FAIL " << exp.name << " final flush\n";
        ++failures;
    } else {
        std::cout << "PASS final flush\n";
    }

    trace.close();
    dut.final();
    std::cout << "Trace: " << trace_path << "\n";
    std::cout << "Checked " << cycle + 1 << " output samples; failures=" << failures << '\n';
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
