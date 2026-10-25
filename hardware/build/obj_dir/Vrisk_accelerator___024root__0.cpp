// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vrisk_accelerator.h for the primary calling header

#include "Vrisk_accelerator__pch.h"

void Vrisk_accelerator___024root___eval_sample(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_sample\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
}

#ifdef VL_DEBUG
VL_ATTR_COLD void Vrisk_accelerator___024root___dump_triggers__ico(const VlUnpacked<QData/*63:0*/, 2> &triggers, const std::string &tag);
#endif  // VL_DEBUG

bool Vrisk_accelerator___024root___eval_ico(Vrisk_accelerator___024root* vlSelf, CData/*0:0*/ firstIteration) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_ico\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    vlSelfRef.__VicoTriggered[1U] = ((0xfffffffffffffffeULL 
                                      & vlSelfRef.__VicoTriggered[1U]) 
                                     | (IData)((IData)(firstIteration)));
    {
        // Inlined CFunc: _eval_triggers_vec__ico
        vlSelfRef.__VicoTriggered[0U] = (QData)((IData)(
                                                        (((((IData)(vlSelfRef.velocity_count) 
                                                            != (IData)(vlSelfRef.__Vtrigprevexpr___TOP__velocity_count__0)) 
                                                           << 5U) 
                                                          | ((vlSelfRef.source_wallet_id 
                                                              != vlSelfRef.__Vtrigprevexpr___TOP__source_wallet_id__0) 
                                                             << 4U)) 
                                                         | ((((vlSelfRef.amount 
                                                               != vlSelfRef.__Vtrigprevexpr___TOP__amount__0) 
                                                              << 3U) 
                                                             | (((IData)(vlSelfRef.valid_in) 
                                                                 != (IData)(vlSelfRef.__Vtrigprevexpr___TOP__valid_in__0)) 
                                                                << 2U)) 
                                                            | ((((IData)(vlSelfRef.rst_n) 
                                                                 != (IData)(vlSelfRef.__Vtrigprevexpr___TOP__rst_n__0)) 
                                                                << 1U) 
                                                               | ((IData)(vlSelfRef.clk) 
                                                                  != (IData)(vlSelfRef.__Vtrigprevexpr___TOP__clk__0)))))));
        vlSelfRef.__Vtrigprevexpr___TOP__clk__0 = vlSelfRef.clk;
        vlSelfRef.__Vtrigprevexpr___TOP__rst_n__0 = vlSelfRef.rst_n;
        vlSelfRef.__Vtrigprevexpr___TOP__valid_in__0 
            = vlSelfRef.valid_in;
        vlSelfRef.__Vtrigprevexpr___TOP__amount__0 
            = vlSelfRef.amount;
        vlSelfRef.__Vtrigprevexpr___TOP__source_wallet_id__0 
            = vlSelfRef.source_wallet_id;
        vlSelfRef.__Vtrigprevexpr___TOP__velocity_count__0 
            = vlSelfRef.velocity_count;
        if (VL_UNLIKELY(((1U & (~ (IData)(vlSelfRef.__VicoDidInit)))))) {
            vlSelfRef.__VicoDidInit = 1U;
            vlSelfRef.__VicoTriggered[0U] = (1ULL | vlSelfRef.__VicoTriggered[0U]);
            vlSelfRef.__VicoTriggered[0U] = (2ULL | vlSelfRef.__VicoTriggered[0U]);
            vlSelfRef.__VicoTriggered[0U] = (4ULL | vlSelfRef.__VicoTriggered[0U]);
            vlSelfRef.__VicoTriggered[0U] = (8ULL | vlSelfRef.__VicoTriggered[0U]);
            vlSelfRef.__VicoTriggered[0U] = (0x0000000000000010ULL 
                                             | vlSelfRef.__VicoTriggered[0U]);
            vlSelfRef.__VicoTriggered[0U] = (0x0000000000000020ULL 
                                             | vlSelfRef.__VicoTriggered[0U]);
        }
    }
#ifdef VL_DEBUG
    if (VL_UNLIKELY(vlSymsp->_vm_contextp__->debug())) {
        Vrisk_accelerator___024root___dump_triggers__ico(vlSelfRef.__VicoTriggered, "ico"s);
    }
#endif
    return (0U);
}

#ifdef VL_DEBUG
VL_ATTR_COLD void Vrisk_accelerator___024root___dump_triggers__act(const VlUnpacked<QData/*63:0*/, 1> &triggers, const std::string &tag);
#endif  // VL_DEBUG
void Vrisk_accelerator___024root___trigger_orInto__act_vec_vec(VlUnpacked<QData/*63:0*/, 1> &out, const VlUnpacked<QData/*63:0*/, 1> &in);

bool Vrisk_accelerator___024root___eval_act(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_act\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    {
        // Inlined CFunc: _eval_triggers_vec__act
        vlSelfRef.__VactTriggered[0U] = (QData)((IData)(
                                                        ((IData)(vlSelfRef.clk) 
                                                         & (~ (IData)(vlSelfRef.__Vtrigprevexpr___TOP__clk__1)))));
        vlSelfRef.__Vtrigprevexpr___TOP__clk__1 = vlSelfRef.clk;
    }
#ifdef VL_DEBUG
    if (VL_UNLIKELY(vlSymsp->_vm_contextp__->debug())) {
        Vrisk_accelerator___024root___dump_triggers__act(vlSelfRef.__VactTriggered, "act"s);
    }
#endif
    Vrisk_accelerator___024root___trigger_orInto__act_vec_vec(vlSelfRef.__VnbaTriggered, vlSelfRef.__VactTriggered);
    return (0U);
}

bool Vrisk_accelerator___024root___eval_inact(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_inact\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    return (0U);
}

bool Vrisk_accelerator___024root___trigger_anySet__act(const VlUnpacked<QData/*63:0*/, 1> &in);
void Vrisk_accelerator___024root___trigger_clear__act(VlUnpacked<QData/*63:0*/, 1> &out);

bool Vrisk_accelerator___024root___eval_nba(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_nba\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Locals
    CData/*0:0*/ __VnbaExecute;
    // Body
    __VnbaExecute = Vrisk_accelerator___024root___trigger_anySet__act(vlSelfRef.__VnbaTriggered);
    if (__VnbaExecute) {
        {
            // Inlined CFunc: _eval_body__nba
            if ((1ULL & vlSelfRef.__VnbaTriggered[0U])) {
                {
                    // Inlined CFunc: _nba_sequent__TOP__0
                    if (vlSelfRef.rst_n) {
                        vlSelfRef.risk_accelerator__DOT__s2_status 
                            = vlSelfRef.risk_accelerator__DOT__s1_status;
                        vlSelfRef.risk_accelerator__DOT__s1_status 
                            = (((0xdeadbeefU == vlSelfRef.source_wallet_id) 
                                << 2U) | (((0x0064U 
                                            < (IData)(vlSelfRef.velocity_count)) 
                                           << 1U) | 
                                          (0x000f4240U 
                                           < vlSelfRef.amount)));
                    } else {
                        vlSelfRef.risk_accelerator__DOT__s2_status = 0U;
                        vlSelfRef.risk_accelerator__DOT__s1_status = 0U;
                    }
                    vlSelfRef.risk_accelerator__DOT__s2_valid 
                        = ((IData)(vlSelfRef.rst_n) 
                           && (IData)(vlSelfRef.risk_accelerator__DOT__s1_valid));
                    vlSelfRef.valid_out = vlSelfRef.risk_accelerator__DOT__s2_valid;
                    vlSelfRef.risk_flag = ((IData)(vlSelfRef.risk_accelerator__DOT__s2_valid) 
                                           & (0U != 
                                              (7U & (IData)(vlSelfRef.risk_accelerator__DOT__s2_status))));
                    vlSelfRef.status_code = ((IData)(vlSelfRef.risk_accelerator__DOT__s2_status) 
                                             & (- (IData)((IData)(vlSelfRef.risk_accelerator__DOT__s2_valid))));
                    vlSelfRef.risk_accelerator__DOT__s1_valid 
                        = ((IData)(vlSelfRef.rst_n) 
                           && (IData)(vlSelfRef.valid_in));
                }
                vlSelfRef.__Vm_traceActivity[1U] = 1U;
            }
        }
        Vrisk_accelerator___024root___trigger_clear__act(vlSelfRef.__VnbaTriggered);
    }
    return (__VnbaExecute);
}

bool Vrisk_accelerator___024root___eval_obs(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_obs\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    return (0U);
}

bool Vrisk_accelerator___024root___eval_react(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_react\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    return (0U);
}

void Vrisk_accelerator___024root___eval_postponed(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_postponed\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
}

bool Vrisk_accelerator___024root___trigger_anySet__ico(const VlUnpacked<QData/*63:0*/, 2> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___trigger_anySet__ico\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        if (in[n]) {
            return (1U);
        }
        n = ((IData)(1U) + n);
    } while ((2U > n));
    return (0U);
}

bool Vrisk_accelerator___024root___trigger_anySet__act(const VlUnpacked<QData/*63:0*/, 1> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___trigger_anySet__act\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        if (in[n]) {
            return (1U);
        }
        n = ((IData)(1U) + n);
    } while ((1U > n));
    return (0U);
}

void Vrisk_accelerator___024root___trigger_orInto__act_vec_vec(VlUnpacked<QData/*63:0*/, 1> &out, const VlUnpacked<QData/*63:0*/, 1> &in) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___trigger_orInto__act_vec_vec\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        out[n] = (out[n] | in[n]);
        n = ((IData)(1U) + n);
    } while ((0U >= n));
}

void Vrisk_accelerator___024root___trigger_clear__act(VlUnpacked<QData/*63:0*/, 1> &out) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___trigger_clear__act\n"); );
    // Locals
    IData/*31:0*/ n;
    // Body
    n = 0U;
    do {
        out[n] = 0ULL;
        n = ((IData)(1U) + n);
    } while ((1U > n));
}

#ifdef VL_DEBUG
void Vrisk_accelerator___024root___eval_debug_assertions(Vrisk_accelerator___024root* vlSelf) {
    VL_DEBUG_IF(VL_DBG_MSGF("+    Vrisk_accelerator___024root___eval_debug_assertions\n"); );
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    auto& vlSelfRef = std::ref(*vlSelf).get();
    // Body
    if (VL_UNLIKELY(((vlSelfRef.clk & 0xfeU)))) {
        Verilated::overWidthError("clk");
    }
    if (VL_UNLIKELY(((vlSelfRef.rst_n & 0xfeU)))) {
        Verilated::overWidthError("rst_n");
    }
    if (VL_UNLIKELY(((vlSelfRef.valid_in & 0xfeU)))) {
        Verilated::overWidthError("valid_in");
    }
}
#endif  // VL_DEBUG
