// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Design implementation internals
// See Vrisk_accelerator.h for the primary calling header

#include "Vrisk_accelerator__pch.h"

void Vrisk_accelerator___024root___ctor_var_reset(Vrisk_accelerator___024root* vlSelf);

Vrisk_accelerator___024root::Vrisk_accelerator___024root(Vrisk_accelerator__Syms* symsp, const char* namep)
 {
    vlSymsp = symsp;
    vlNamep = strdup(namep);
    // Reset structure values
    Vrisk_accelerator___024root___ctor_var_reset(this);
}

void Vrisk_accelerator___024root::__Vconfigure(bool first) {
    (void)first;  // Prevent unused variable warning
}

Vrisk_accelerator___024root::~Vrisk_accelerator___024root() {
    VL_DO_DANGLING(std::free(const_cast<char*>(vlNamep)), vlNamep);
}
