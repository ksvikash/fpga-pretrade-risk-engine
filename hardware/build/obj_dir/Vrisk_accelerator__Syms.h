// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Symbol table internal header
//
// Internal details; most calling programs do not need this header,
// unless using verilator public meta comments.

#ifndef VERILATED_VRISK_ACCELERATOR__SYMS_H_
#define VERILATED_VRISK_ACCELERATOR__SYMS_H_  // guard

#include "verilated.h"

// INCLUDE MODEL CLASS

#include "Vrisk_accelerator.h"

// INCLUDE MODULE CLASSES
#include "Vrisk_accelerator___024root.h"

// SYMS CLASS (contains all model state)
class alignas(VL_CACHE_LINE_BYTES) Vrisk_accelerator__Syms final : public VerilatedSyms {
  public:
    // INTERNAL STATE
    Vrisk_accelerator* const __Vm_modelp;
    bool __Vm_activity = false;  ///< Used by trace routines to determine change occurred
    uint32_t __Vm_baseCode = 0;  ///< Used by trace routines when tracing multiple models
    VlDeleter __Vm_deleter;
    bool& __Vm_didInit;

    // MODULE INSTANCE STATE
    Vrisk_accelerator___024root    TOP;

    // CONSTRUCTORS
    Vrisk_accelerator__Syms(VerilatedContext* contextp, const char* namep, Vrisk_accelerator* modelp);
    ~Vrisk_accelerator__Syms();

    // METHODS
    const char* name() const { return TOP.vlNamep; }
};

#endif  // guard
