// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Tracing implementation internals

#include "verilated_vcd_c.h"
#include "Vrisk_accelerator__Syms.h"


void Vrisk_accelerator___024root__trace_chg_0_sub_0(Vrisk_accelerator___024root* vlSelf, VerilatedVcd::Buffer* bufp);

void Vrisk_accelerator___024root__trace_chg_0(void* voidSelf, VerilatedVcd::Buffer* bufp) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root__trace_chg_0\n"); );
    // Body
    Vrisk_accelerator___024root* const __restrict vlSelf VL_ATTR_UNUSED = static_cast<Vrisk_accelerator___024root*>(voidSelf);
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    if (VL_UNLIKELY(!vlSymsp->__Vm_activity)) return;
    Vrisk_accelerator___024root__trace_chg_0_sub_0((&vlSymsp->TOP), bufp);
}

void Vrisk_accelerator___024root__trace_chg_0_sub_0(Vrisk_accelerator___024root* vlSelf, VerilatedVcd::Buffer* bufp) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root__trace_chg_0_sub_0\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    uint32_t* const oldp VL_ATTR_UNUSED = bufp->oldp(vlSymsp->__Vm_baseCode + 0);
    if (VL_UNLIKELY((vlSelfRef.__Vm_traceActivity[1U]))) {
        bufp->chgBit(oldp+0,(vlSelfRef.risk_accelerator__DOT__s2_valid));
        bufp->chgBit(oldp+1,(vlSelfRef.risk_accelerator__DOT__s1_valid));
        bufp->chgCData(oldp+2,(vlSelfRef.risk_accelerator__DOT__s1_status),3);
        bufp->chgCData(oldp+3,(vlSelfRef.risk_accelerator__DOT__s2_status),4);
    }
    bufp->chgBit(oldp+4,(vlSelfRef.clk));
    bufp->chgBit(oldp+5,(vlSelfRef.rst_n));
    bufp->chgBit(oldp+6,(vlSelfRef.valid_in));
    bufp->chgIData(oldp+7,(vlSelfRef.amount),32);
    bufp->chgIData(oldp+8,(vlSelfRef.source_wallet_id),32);
    bufp->chgSData(oldp+9,(vlSelfRef.velocity_count),16);
    bufp->chgBit(oldp+10,(vlSelfRef.risk_flag));
    bufp->chgCData(oldp+11,(vlSelfRef.status_code),4);
}

void Vrisk_accelerator___024root__trace_cleanup(void* voidSelf, VerilatedVcd* /*unused*/) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root__trace_cleanup\n"); );
    // Body
    Vrisk_accelerator___024root* const __restrict vlSelf VL_ATTR_UNUSED = static_cast<Vrisk_accelerator___024root*>(voidSelf);
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    vlSymsp->__Vm_activity = false;
    vlSymsp->TOP.__Vm_traceActivity[0U] = 0U;
    vlSymsp->TOP.__Vm_traceActivity[1U] = 0U;
}
