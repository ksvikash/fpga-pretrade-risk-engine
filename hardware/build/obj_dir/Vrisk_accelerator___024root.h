// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design internal header
// See Vrisk_accelerator.h for the primary calling header

#ifndef VERILATED_VRISK_ACCELERATOR___024ROOT_H_
#define VERILATED_VRISK_ACCELERATOR___024ROOT_H_  // guard

#include "verilated.h"


class Vrisk_accelerator__Syms;

class alignas(VL_CACHE_LINE_BYTES) Vrisk_accelerator___024root final {
  public:

    // DESIGN SPECIFIC STATE
    VL_IN8(clk,0,0);
    VL_IN8(rst_n,0,0);
    VL_IN8(valid_in,0,0);
    VL_OUT8(valid_out,0,0);
    VL_OUT8(risk_flag,0,0);
    VL_OUT8(status_code,3,0);
    CData/*0:0*/ risk_accelerator__DOT__s1_valid;
    CData/*2:0*/ risk_accelerator__DOT__s1_status;
    CData/*0:0*/ risk_accelerator__DOT__s2_valid;
    CData/*3:0*/ risk_accelerator__DOT__s2_status;
    CData/*0:0*/ __Vtrigprevexpr___TOP__clk__0;
    CData/*0:0*/ __Vtrigprevexpr___TOP__rst_n__0;
    CData/*0:0*/ __Vtrigprevexpr___TOP__valid_in__0;
    CData/*0:0*/ __VicoDidInit;
    CData/*0:0*/ __Vtrigprevexpr___TOP__clk__1;
    VL_IN16(velocity_count,15,0);
    SData/*15:0*/ __Vtrigprevexpr___TOP__velocity_count__0;
    VL_IN(amount,31,0);
    VL_IN(source_wallet_id,31,0);
    IData/*31:0*/ __Vtrigprevexpr___TOP__amount__0;
    IData/*31:0*/ __Vtrigprevexpr___TOP__source_wallet_id__0;
    VlUnpacked<QData/*63:0*/, 1> __VstlTriggered;
    VlUnpacked<QData/*63:0*/, 2> __VicoTriggered;
    VlUnpacked<QData/*63:0*/, 1> __VactTriggered;
    VlUnpacked<QData/*63:0*/, 1> __VnbaTriggered;
    VlUnpacked<CData/*0:0*/, 2> __Vm_traceActivity;

    // INTERNAL VARIABLES
    Vrisk_accelerator__Syms* vlSymsp;
    const char* vlNamep;

    // CONSTRUCTORS
    Vrisk_accelerator___024root(Vrisk_accelerator__Syms* symsp, const char* namep);
    ~Vrisk_accelerator___024root();
    VL_UNCOPYABLE(Vrisk_accelerator___024root);

    // INTERNAL METHODS
    void __Vconfigure(bool first);
};


#endif  // guard
