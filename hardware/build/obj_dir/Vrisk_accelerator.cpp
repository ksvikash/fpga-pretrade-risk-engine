// Verilated -*- C++ -*-
// DESCRIPTION: Verilator output: Model implementation (design independent parts)

#include "Vrisk_accelerator__pch.h"
#include "verilated_vcd_c.h"

//============================================================
// Constructors

Vrisk_accelerator::Vrisk_accelerator(VerilatedContext* _vcontextp__, const char* _vcname__)
    : VerilatedModel{*_vcontextp__}
    , vlSymsp{new Vrisk_accelerator__Syms(contextp(), _vcname__, this)}
    , m_evalLoop{*this, /*convergeLimit:*/ 10000}
    , clk{vlSymsp->TOP.clk}
    , rst_n{vlSymsp->TOP.rst_n}
    , valid_in{vlSymsp->TOP.valid_in}
    , valid_out{vlSymsp->TOP.valid_out}
    , risk_flag{vlSymsp->TOP.risk_flag}
    , status_code{vlSymsp->TOP.status_code}
    , velocity_count{vlSymsp->TOP.velocity_count}
    , amount{vlSymsp->TOP.amount}
    , source_wallet_id{vlSymsp->TOP.source_wallet_id}
    , rootp{&(vlSymsp->TOP)}
{
    // Register model with the context
    contextp()->addModel(this);
    contextp()->traceBaseModelCbAdd(
        [this](VerilatedTraceBaseC* tfp, int levels, int options) { traceBaseModel(tfp, levels, options); });
}

Vrisk_accelerator::Vrisk_accelerator(const char* _vcname__)
    : Vrisk_accelerator(Verilated::threadContextp(), _vcname__)
{
}

//============================================================
// Destructor

Vrisk_accelerator::~Vrisk_accelerator() {
    delete vlSymsp;
}

//============================================================
// Evaluation function

#ifdef VL_DEBUG
void Vrisk_accelerator___024root___eval_debug_assertions(Vrisk_accelerator___024root* vlSelf);
#endif  // VL_DEBUG
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_static(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_initial(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD bool Vrisk_accelerator___024root___eval_stl(Vrisk_accelerator___024root* vlSelf, CData/*0:0*/ firstIteration);
void Vrisk_accelerator___024root___eval_sample(Vrisk_accelerator___024root* vlSelf);
bool Vrisk_accelerator___024root___eval_ico(Vrisk_accelerator___024root* vlSelf, CData/*0:0*/ firstIteration);
bool Vrisk_accelerator___024root___eval_act(Vrisk_accelerator___024root* vlSelf);
bool Vrisk_accelerator___024root___eval_inact(Vrisk_accelerator___024root* vlSelf);
bool Vrisk_accelerator___024root___eval_nba(Vrisk_accelerator___024root* vlSelf);
bool Vrisk_accelerator___024root___eval_obs(Vrisk_accelerator___024root* vlSelf);
bool Vrisk_accelerator___024root___eval_react(Vrisk_accelerator___024root* vlSelf);
void Vrisk_accelerator___024root___eval_postponed(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_final(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_dump_triggers__stl(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_dump_triggers__ico(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_dump_triggers__act(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_dump_triggers__nba(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_dump_triggers__obs(Vrisk_accelerator___024root* vlSelf);
VL_ATTR_COLD void Vrisk_accelerator___024root___eval_dump_triggers__react(Vrisk_accelerator___024root* vlSelf);

void Vrisk_accelerator::eval_step() {
    VL_DEBUG_IF(VL_DBG_MSGF("+++++TOP Evaluate Vrisk_accelerator::eval_step\n"); );
    m_evalLoop.eval();
}

void Vrisk_accelerator::evalBegin() {
#ifdef VL_DEBUG
    // Debug assertions
    Vrisk_accelerator___024root___eval_debug_assertions(&(vlSymsp->TOP));
#endif  // VL_DEBUG
    vlSymsp->__Vm_activity = true;
    vlSymsp->__Vm_deleter.deleteAll();
}

void Vrisk_accelerator::evalEnd() {
    // Evaluate cleanup
    Verilated::endOfEval(vlSymsp->__Vm_evalMsgQp);
}

void Vrisk_accelerator::evalStatic() {
    Vrisk_accelerator___024root___eval_static(&(vlSymsp->TOP));
}

void Vrisk_accelerator::evalInitial() {
    Vrisk_accelerator___024root___eval_initial(&(vlSymsp->TOP));
}

bool Vrisk_accelerator::evalStl(bool firstIteration) {
    return Vrisk_accelerator___024root___eval_stl(&(vlSymsp->TOP), firstIteration);
}

void Vrisk_accelerator::evalSample() {
    Vrisk_accelerator___024root___eval_sample(&(vlSymsp->TOP));
}

bool Vrisk_accelerator::evalIco(bool firstIteration) {
    return Vrisk_accelerator___024root___eval_ico(&(vlSymsp->TOP), firstIteration);
}

bool Vrisk_accelerator::evalAct() {
    return Vrisk_accelerator___024root___eval_act(&(vlSymsp->TOP));
}

bool Vrisk_accelerator::evalInact() {
    return Vrisk_accelerator___024root___eval_inact(&(vlSymsp->TOP));
}

bool Vrisk_accelerator::evalNba() {
    return Vrisk_accelerator___024root___eval_nba(&(vlSymsp->TOP));
}

bool Vrisk_accelerator::evalObs() {
    return Vrisk_accelerator___024root___eval_obs(&(vlSymsp->TOP));
}

bool Vrisk_accelerator::evalReact() {
    return Vrisk_accelerator___024root___eval_react(&(vlSymsp->TOP));
}

void Vrisk_accelerator::evalPostponed() {
    Vrisk_accelerator___024root___eval_postponed(&(vlSymsp->TOP));
}

void Vrisk_accelerator::evalFinal() {
    Vrisk_accelerator___024root___eval_final(&(vlSymsp->TOP));
}

VL_ATTR_COLD void Vrisk_accelerator::dumpTriggersStl() {
    Vrisk_accelerator___024root___eval_dump_triggers__stl(&(vlSymsp->TOP));
}

VL_ATTR_COLD void Vrisk_accelerator::dumpTriggersIco() {
    Vrisk_accelerator___024root___eval_dump_triggers__ico(&(vlSymsp->TOP));
}

VL_ATTR_COLD void Vrisk_accelerator::dumpTriggersAct() {
    Vrisk_accelerator___024root___eval_dump_triggers__act(&(vlSymsp->TOP));
}

VL_ATTR_COLD void Vrisk_accelerator::dumpTriggersNba() {
    Vrisk_accelerator___024root___eval_dump_triggers__nba(&(vlSymsp->TOP));
}

VL_ATTR_COLD void Vrisk_accelerator::dumpTriggersObs() {
    Vrisk_accelerator___024root___eval_dump_triggers__obs(&(vlSymsp->TOP));
}

VL_ATTR_COLD void Vrisk_accelerator::dumpTriggersReact() {
    Vrisk_accelerator___024root___eval_dump_triggers__react(&(vlSymsp->TOP));
}

//============================================================
// Events and timing
bool Vrisk_accelerator::eventsPending() { return false; }

uint64_t Vrisk_accelerator::nextTimeSlot() {
    VL_FATAL_MT(__FILE__, __LINE__, "", "No delays in the design");
    return 0;
}

//============================================================
// Utilities

const char* Vrisk_accelerator::name() const {
    return vlSymsp->name();
}

//============================================================
// Invoke final blocks

VL_ATTR_COLD void Vrisk_accelerator::final() {
    contextp()->executingFinal(true);
    evalFinal();
    contextp()->executingFinal(false);
}

//============================================================
// Implementations of abstract methods from VerilatedModel

const char* Vrisk_accelerator::hierName() const { return vlSymsp->name(); }
const char* Vrisk_accelerator::modelName() const { return "Vrisk_accelerator"; }
unsigned Vrisk_accelerator::threads() const { return 1; }
void Vrisk_accelerator::prepareClone() const { contextp()->prepareClone(); }
void Vrisk_accelerator::atClone() const {
    contextp()->threadPoolpOnClone();
}
std::unique_ptr<VerilatedTraceConfig> Vrisk_accelerator::traceConfig() const {
    return std::unique_ptr<VerilatedTraceConfig>{new VerilatedTraceConfig{false}};
};

//============================================================
// Trace configuration

void Vrisk_accelerator___024root__trace_decl_types(VerilatedVcd* tracep);

void Vrisk_accelerator___024root__trace_init_top(Vrisk_accelerator___024root* vlSelf, VerilatedVcd* tracep);

VL_ATTR_COLD static void trace_init(void* voidSelf, VerilatedVcd* tracep, uint32_t code) {
    // Callback from tracep->open()
    Vrisk_accelerator___024root* const __restrict vlSelf VL_ATTR_UNUSED = static_cast<Vrisk_accelerator___024root*>(voidSelf);
    Vrisk_accelerator__Syms* const __restrict vlSymsp VL_ATTR_UNUSED = vlSelf->vlSymsp;
    if (!vlSymsp->_vm_contextp__->calcUnusedSigs()) {
        VL_FATAL_MT(__FILE__, __LINE__, __FILE__,
            "Turning on wave traces requires Verilated::traceEverOn(true) call before time 0.");
    }
    vlSymsp->__Vm_baseCode = code;
    tracep->pushPrefix(vlSymsp->name(), VerilatedTracePrefixType::SCOPE_MODULE);
    Vrisk_accelerator___024root__trace_decl_types(tracep);
    Vrisk_accelerator___024root__trace_init_top(vlSelf, tracep);
    tracep->popPrefix();
}

VL_ATTR_COLD void Vrisk_accelerator___024root__trace_register(Vrisk_accelerator___024root* vlSelf, VerilatedVcd* tracep);

VL_ATTR_COLD void Vrisk_accelerator::traceBaseModel(VerilatedTraceBaseC* tfp, int levels, int options) {
    (void)levels; (void)options;
    VerilatedVcdC* const stfp = dynamic_cast<VerilatedVcdC*>(tfp);
    if (VL_UNLIKELY(!stfp)) {
        vl_fatal(__FILE__, __LINE__, __FILE__,"'Vrisk_accelerator::trace()' called on non-VerilatedVcdC object;"
            " use --trace-fst with VerilatedFst object, and --trace-vcd with VerilatedVcd object");
    }
    stfp->spTrace()->addModel(this);
    stfp->spTrace()->addInitCb(&trace_init, &(vlSymsp->TOP), name(), false, 15);
    Vrisk_accelerator___024root__trace_register(&(vlSymsp->TOP), stfp->spTrace());
}
