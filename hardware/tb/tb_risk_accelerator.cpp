#include "Vrisk_accelerator.h"
#include "verilated.h"
#include "verilated_vcd_c.h"

#include <cstdint>
#include <cstdlib>
#include <deque>
#include <iostream>
#include <string>
#include <vector>

namespace {
constexpr uint32_t kAmountLimit = 1'000'000;
constexpr uint16_t kVelocityLimit = 100;
constexpr uint32_t kWatchedWallet = 0xDEADBEEF;
constexpr unsigned kFifoDepth = 16;

struct Packet {
    const char* name;
    uint32_t amount;
    uint16_t velocity;
    uint32_t wallet;
};

struct Decision {
    bool valid = false;
    uint8_t status = 0;
};

struct Alert {
    const char* name;
    uint64_t timestamp;
    uint32_t amount;
    uint16_t velocity;
    uint32_t wallet;
    uint8_t status;
};

class Bench {
  public:
    Bench(Vrisk_accelerator& dut, VerilatedVcdC& trace)
        : dut_(dut), trace_(trace) {}

    bool cycle(bool valid, const Packet* packet, bool read = false) {
        dut_.s_axis_aclk = 0;
        dut_.s_axis_tvalid = valid;
        dut_.s_axis_tdata[0] = packet ? packet->wallet : 0;
        dut_.s_axis_tdata[1] = packet
            ? ((packet->amount << 16) | packet->velocity) : 0;
        dut_.s_axis_tdata[2] = packet ? (packet->amount >> 16) : 0;
        dut_.fifo_read_en = read;
        dut_.eval();
        trace_.dump(time_++);

        const bool accepted = valid && dut_.s_axis_tready;
        const Decision expected_output = stage1_;
        if (accepted) {
            const auto amount = packet->amount;
            const auto velocity = packet->velocity;
            const auto wallet = packet->wallet;
            uint8_t status = 0;
            if (amount > kAmountLimit) status |= 1;
            if (velocity > kVelocityLimit) status |= 2;
            if (wallet == kWatchedWallet) status |= 4;
            if (status != 0) {
                alerts_.push_back({"stream-alert", next_timestamp_, amount,
                                   velocity, wallet, status});
            }
            stage1_ = {true, status};
            ++next_timestamp_;
        } else {
            stage1_ = {};
        }

        dut_.s_axis_aclk = 1;
        dut_.eval();
        trace_.dump(time_++);
        check_decision(expected_output);
        ++cycles_;
        return accepted;
    }

    bool send(const Packet& packet) {
        for (unsigned attempts = 0; attempts < 100; ++attempts) {
            if (cycle(true, &packet)) return true;
            ++backpressure_cycles_;
        }
        std::cerr << "FAIL timed out waiting for tready on " << packet.name << '\n';
        ++failures_;
        return false;
    }

    void idle(unsigned count = 1) {
        for (unsigned i = 0; i < count; ++i) cycle(false, nullptr);
    }

    bool check_front(const Alert& expected) {
        dut_.s_axis_aclk = 0;
        dut_.fifo_read_en = 0;
        dut_.eval();
        if (dut_.fifo_empty) {
            std::cerr << "FAIL FIFO empty; expected alert " << expected.name << '\n';
            ++failures_;
            return false;
        }
        const auto* words = dut_.fifo_dout.m_storage;
        const uint32_t wallet = words[0];
        const uint32_t amount = words[1];
        const uint16_t velocity = static_cast<uint16_t>(words[2] & 0xffffu);
        const uint8_t status = static_cast<uint8_t>((words[2] >> 16) & 0x0fu);
        const uint64_t timestamp =
            (static_cast<uint64_t>(words[2] >> 20) & 0xfffu) |
            (static_cast<uint64_t>(words[3]) << 12) |
            (static_cast<uint64_t>(words[4] & 0xfffffu) << 44);
        const bool match = wallet == expected.wallet && amount == expected.amount &&
                           velocity == expected.velocity && status == expected.status &&
                           timestamp == expected.timestamp;
        if (!match) {
            std::cerr << "FAIL FIFO " << expected.name << ": wallet=0x" << std::hex
                      << wallet << " amount=" << amount << " velocity=" << velocity
                      << " status=0x" << static_cast<unsigned>(status)
                      << " timestamp=" << std::dec << timestamp << '\n';
            ++failures_;
        } else {
            std::cout << "PASS FIFO " << expected.name << " timestamp=" << timestamp << '\n';
        }
        return match;
    }

    void pop() { cycle(false, nullptr, true); }
    int failures() const { return failures_; }
    void record_failure() { ++failures_; }
    size_t backpressure_cycles() const { return backpressure_cycles_; }
    size_t cycles() const { return cycles_; }
    std::deque<Alert>& alerts() { return alerts_; }

  private:
    void check_decision(const Decision& expected) {
        const bool got_valid = dut_.valid_out;
        const uint8_t got_status = dut_.status_code;
        const bool got_risk = dut_.risk_flag;
        const bool expected_risk = expected.valid && expected.status != 0;
        if (got_valid != expected.valid || got_status != (expected.valid ? expected.status : 0) ||
            got_risk != expected_risk) {
            std::cerr << "FAIL stream decision: valid=" << got_valid
                      << " status=0x" << std::hex << static_cast<unsigned>(got_status)
                      << " risk=" << got_risk << std::dec << '\n';
            ++failures_;
        }
    }

    Vrisk_accelerator& dut_;
    VerilatedVcdC& trace_;
    Decision stage1_{};
    std::deque<Alert> alerts_;
    uint64_t next_timestamp_ = 0;
    vluint64_t time_ = 0;
    size_t cycles_ = 0;
    size_t backpressure_cycles_ = 0;
    int failures_ = 0;
};
}  // namespace

int main(int argc, char** argv) {
    Verilated::commandArgs(argc, argv);
    Verilated::traceEverOn(true);

    Vrisk_accelerator dut;
    VerilatedVcdC trace;
    dut.trace(&trace, 99);
    const std::string trace_path = argc > 1 ? argv[1] : "risk_accelerator.vcd";
    trace.open(trace_path.c_str());
    Bench bench(dut, trace);

    dut.s_axis_aclk = 0;
    dut.s_axis_aresetn = 0;
    dut.s_axis_tvalid = 0;
    dut.s_axis_tdata[0] = 0;
    dut.s_axis_tdata[1] = 0;
    dut.s_axis_tdata[2] = 0;
    dut.fifo_read_en = 0;
    bench.cycle(false, nullptr);
    bench.cycle(false, nullptr);
    dut.s_axis_aresetn = 1;

    const std::vector<Packet> directed = {
        {"normal", 50'000, 3, 0x12345678},
        {"amount-at-limit", kAmountLimit, 20, 0x12345678},
        {"amount-over-limit", kAmountLimit + 1, 20, 0x12345678},
        {"velocity-at-limit", 12'000, kVelocityLimit, 0x12345678},
        {"velocity-surge", 12'000, kVelocityLimit + 1, 0x12345678},
        {"watched-wallet", 12'000, 2, kWatchedWallet},
        {"multiple-triggers", kAmountLimit + 4, 500, kWatchedWallet},
        {"recovery", 1, 0, 0x01020304},
    };
    for (const auto& packet : directed) bench.send(packet);
    bench.idle(3);

    if (dut.fifo_count != 4) {
        std::cerr << "FAIL expected 4 directed alerts, FIFO count=" << dut.fifo_count << '\n';
        return EXIT_FAILURE;
    }
    for (unsigned i = 0; i < 4; ++i) {
        const Alert expected = bench.alerts().front();
        bench.check_front(expected);
        bench.pop();
        bench.alerts().pop_front();
    }
    if (!dut.fifo_empty) {
        std::cerr << "FAIL FIFO did not empty after directed drain\n";
        bench.record_failure();
    }

    // Fill the alert FIFO without draining it. The AXI source must eventually
    // see tready deasserted; the in-flight reservation prevents overflow.
    for (unsigned i = 0; i < kFifoDepth; ++i) {
        const Packet packet{"fifo-fill", kAmountLimit + 10 + i,
                            static_cast<uint16_t>(kVelocityLimit + 1),
                            0x90000000u + i};
        bench.send(packet);
    }
    bench.idle(3);
    if (dut.fifo_count != kFifoDepth || dut.s_axis_tready) {
        std::cerr << "FAIL full FIFO/backpressure: count=" << dut.fifo_count
                  << " tready=" << static_cast<unsigned>(dut.s_axis_tready) << '\n';
        bench.record_failure();
    } else {
        std::cout << "PASS FIFO full backpressure\n";
    }

    // Pop one alert to make room, then prove that the stream resumes and that
    // the ring buffer preserves order across pointer wraparound.
    const Alert first_full_alert = bench.alerts().front();
    bench.check_front(first_full_alert);
    bench.pop();
    bench.alerts().pop_front();
    const Packet resumed{"resumed-after-pop", kAmountLimit + 99, 250, 0xAABBCCDD};
    bench.send(resumed);
    bench.idle(3);
    if (dut.fifo_count != kFifoDepth) {
        std::cerr << "FAIL FIFO count after resumed transfer: " << dut.fifo_count << '\n';
        bench.record_failure();
    }

    while (!bench.alerts().empty()) {
        const Alert expected = bench.alerts().front();
        bench.check_front(expected);
        bench.pop();
        bench.alerts().pop_front();
    }
    if (!dut.fifo_empty || dut.fifo_count != 0) {
        std::cerr << "FAIL FIFO not empty after final drain\n";
        bench.record_failure();
    }

    trace.close();
    dut.final();
    std::cout << "Trace: " << trace_path << '\n'
              << "Cycles=" << bench.cycles()
              << " backpressure_cycles=" << bench.backpressure_cycles()
              << " failures=" << bench.failures() << '\n';
    return bench.failures() == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
