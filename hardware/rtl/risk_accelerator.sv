// AXI4-Stream pre-trade risk classifier with a reserved-capacity alert FIFO.
// s_axis_tdata = {amount[31:0], velocity[15:0], wallet_id[31:0]}.
module risk_accelerator #(
    parameter logic [31:0] AMOUNT_LIMIT = 32'd1_000_000,
    parameter logic [15:0] VELOCITY_LIMIT = 16'd100,
    parameter logic [31:0] WATCHED_WALLET_ID = 32'hDEAD_BEEF,
    parameter integer FIFO_DEPTH = 16,
    parameter integer TIMESTAMP_WIDTH = 64
) (
    input  logic        s_axis_aclk,
    input  logic        s_axis_aresetn,
    input  logic        s_axis_tvalid,
    output logic        s_axis_tready,
    input  logic [79:0] s_axis_tdata,

    output logic        valid_out,
    output logic        risk_flag,
    // bit 0: amount threshold; bit 1: velocity threshold;
    // bit 2: watched wallet; bit 3: reserved and always zero.
    output logic [3:0]  status_code,

    input  logic                         fifo_read_en,
    output logic [TIMESTAMP_WIDTH+83:0]   fifo_dout,
    output logic                         fifo_empty,
    output logic [$clog2(FIFO_DEPTH+1)-1:0] fifo_count
);

    localparam integer PTR_WIDTH = (FIFO_DEPTH <= 2) ? 1 : $clog2(FIFO_DEPTH);
    localparam integer RESERVED_WIDTH = $clog2(FIFO_DEPTH + 3);
    localparam logic [RESERVED_WIDTH-1:0] FIFO_DEPTH_COUNT = RESERVED_WIDTH'(FIFO_DEPTH);
    localparam logic [PTR_WIDTH-1:0] LAST_PTR = PTR_WIDTH'(FIFO_DEPTH - 1);

    // FIFO layout, MSB to LSB:
    // {timestamp[TIMESTAMP_WIDTH-1:0], status[3:0], velocity[15:0],
    //  amount[31:0], wallet_id[31:0]}.
    logic [TIMESTAMP_WIDTH+83:0] alert_mem [0:FIFO_DEPTH-1];
    logic [PTR_WIDTH-1:0] wr_ptr;
    logic [PTR_WIDTH-1:0] rd_ptr;
    logic [TIMESTAMP_WIDTH-1:0] timestamp_counter;

    logic       s1_valid;
    logic [2:0] s1_status;
    logic [31:0] s1_amount;
    logic [15:0] s1_velocity;
    logic [31:0] s1_wallet_id;
    logic [TIMESTAMP_WIDTH-1:0] s1_timestamp;

    logic       s2_valid;
    logic [3:0] s2_status;
    logic [31:0] s2_amount;
    logic [15:0] s2_velocity;
    logic [31:0] s2_wallet_id;
    logic [TIMESTAMP_WIDTH-1:0] s2_timestamp;

    logic [RESERVED_WIDTH-1:0] reserved_slots;
    logic push_alert;
    logic pop_alert;
    logic [PTR_WIDTH-1:0] wr_ptr_next;
    logic [PTR_WIDTH-1:0] rd_ptr_next;

    // Reserve one possible FIFO entry for every accepted transaction still
    // in flight. This worst-case reservation prevents alert loss even when
    // every packet in the pipeline is risky. A full FIFO backpressures input.
    always_comb begin
        reserved_slots = fifo_count + s1_valid + s2_valid;
        s_axis_tready = s_axis_aresetn && (reserved_slots < FIFO_DEPTH_COUNT);
        fifo_empty = (fifo_count == '0);
        fifo_dout = fifo_empty ? '0 : alert_mem[rd_ptr];
        valid_out = s2_valid;
        status_code = s2_valid ? s2_status : 4'b0000;
        risk_flag = s2_valid && (|s2_status[2:0]);
    end

    assign push_alert = risk_flag;
    assign pop_alert = fifo_read_en && !fifo_empty;

    always_comb begin
        wr_ptr_next = (wr_ptr == LAST_PTR) ? '0 : wr_ptr + 1'b1;
        rd_ptr_next = (rd_ptr == LAST_PTR) ? '0 : rd_ptr + 1'b1;
    end

    // Two-stage, one-transfer-per-cycle fast-path datapath. The timestamp is
    // captured on AXI handshake so it identifies ingress acceptance time.
    always_ff @(posedge s_axis_aclk) begin
        if (!s_axis_aresetn) begin
            s1_valid <= 1'b0;
            s1_status <= 3'b000;
            s1_amount <= '0;
            s1_velocity <= '0;
            s1_wallet_id <= '0;
            s1_timestamp <= '0;
            s2_valid <= 1'b0;
            s2_status <= 4'b0000;
            s2_amount <= '0;
            s2_velocity <= '0;
            s2_wallet_id <= '0;
            s2_timestamp <= '0;
            timestamp_counter <= '0;
        end else begin
            s1_valid <= s_axis_tvalid && s_axis_tready;
            if (s_axis_tvalid && s_axis_tready) begin
                s1_amount <= s_axis_tdata[79:48];
                s1_velocity <= s_axis_tdata[47:32];
                s1_wallet_id <= s_axis_tdata[31:0];
                s1_status[0] <= (s_axis_tdata[79:48] > AMOUNT_LIMIT);
                s1_status[1] <= (s_axis_tdata[47:32] > VELOCITY_LIMIT);
                s1_status[2] <= (s_axis_tdata[31:0] == WATCHED_WALLET_ID);
                s1_timestamp <= timestamp_counter;
                timestamp_counter <= timestamp_counter + 1'b1;
            end

            s2_valid <= s1_valid;
            s2_status <= {1'b0, s1_status};
            s2_amount <= s1_amount;
            s2_velocity <= s1_velocity;
            s2_wallet_id <= s1_wallet_id;
            s2_timestamp <= s1_timestamp;
        end
    end

    // Synchronous FIFO. Read data is a combinational peek at the head and is
    // consumed on a rising edge when fifo_read_en && !fifo_empty.
    always_ff @(posedge s_axis_aclk) begin
        if (!s_axis_aresetn) begin
            wr_ptr <= '0;
            rd_ptr <= '0;
            fifo_count <= '0;
        end else begin
            if (push_alert) begin
                alert_mem[wr_ptr] <= {s2_timestamp, s2_status, s2_velocity,
                                      s2_amount, s2_wallet_id};
                wr_ptr <= wr_ptr_next;
            end
            if (pop_alert)
                rd_ptr <= rd_ptr_next;

            case ({push_alert, pop_alert})
                2'b10: fifo_count <= fifo_count + 1'b1;
                2'b01: fifo_count <= fifo_count - 1'b1;
                default: fifo_count <= fifo_count;
            endcase
        end
    end

endmodule
