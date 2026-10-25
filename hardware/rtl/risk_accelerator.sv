// Two-stage streaming risk classifier for a pre-trade gateway.
// Amount units are application-defined integer ticks (for example, cents or satoshis).
module risk_accelerator #(
    parameter logic [31:0] AMOUNT_LIMIT = 32'd1_000_000,
    parameter logic [15:0] VELOCITY_LIMIT = 16'd100,
    parameter logic [31:0] WATCHED_WALLET_ID = 32'hDEAD_BEEF
) (
    input  logic        clk,
    input  logic        rst_n,
    input  logic        valid_in,
    input  logic [31:0] amount,
    input  logic [31:0] source_wallet_id,
    input  logic [15:0] velocity_count,
    output logic        valid_out,
    output logic        risk_flag,
    // status_code[0]: amount limit; [1]: velocity limit;
    // [2]: exact watched-wallet match; [3]: reserved (always zero).
    output logic [3:0]  status_code
);

    logic       s1_valid;
    logic [2:0] s1_status;
    logic       s2_valid;
    logic [3:0] s2_status;

    // Stage 1: independent parallel comparisons. Strict 'greater-than' keeps
    // the configured boundary value in the allowed region.
    always_ff @(posedge clk) begin
        if (!rst_n) begin
            s1_valid  <= 1'b0;
            s1_status <= 3'b000;
        end else begin
            s1_valid       <= valid_in;
            s1_status[0]   <= (amount > AMOUNT_LIMIT);
            s1_status[1]   <= (velocity_count > VELOCITY_LIMIT);
            s1_status[2]   <= (source_wallet_id == WATCHED_WALLET_ID);
        end
    end

    // Stage 2: publish the registered decision. OR reduction is the risk
    // policy; status bits preserve the reason for downstream audit/debug.
    always_ff @(posedge clk) begin
        if (!rst_n) begin
            s2_valid  <= 1'b0;
            s2_status <= 4'b0000;
        end else begin
            s2_valid  <= s1_valid;
            s2_status <= {1'b0, s1_status};
        end
    end

    always_comb begin
        valid_out   = s2_valid;
        status_code = s2_valid ? s2_status : 4'b0000;
        risk_flag   = s2_valid && (|s2_status[2:0]);
    end

endmodule
