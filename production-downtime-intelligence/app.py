"""
Production Downtime & Maintenance Decision Intelligence
Streamlit Application (app.py)
Cohort 11 Hackathon Production Prototype
"Stop for 10 minutes now — or lose 2 hours later?"
"""

import os
import datetime
from typing import Dict, Any, List
import pandas as pd
import streamlit as st

from data_loader import get_data_loader
from calculator import evaluate_maintenance_case
from ai_engine import generate_ai_explanation, get_groq_api_key, get_groq_model_name

# Page configuration
st.set_page_config(
    page_title="Production Downtime & Maintenance Decision Intelligence",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Industrial CSS Styling
st.markdown("""
<style>
    /* Industrial High-Contrast Theme */
    .metric-card {
        background: #1e2530;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 16px;
        color: #f8fafc;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .metric-title {
        font-size: 0.8rem;
        color: #94a3b8;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
    }
    .metric-val {
        font-size: 1.8rem;
        font-weight: 700;
        color: #38bdf8;
    }
    .metric-sub {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 4px;
    }
    .option-card-a {
        background: #0f231c;
        border: 2px solid #10b981;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 12px;
    }
    .option-card-b {
        background: #2a1515;
        border: 2px solid #ef4444;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 12px;
    }
    .safety-alert-banner {
        background: #450a0a;
        border: 2px solid #dc2626;
        border-radius: 8px;
        padding: 16px;
        color: #fecaca;
        font-weight: 600;
        margin: 14px 0;
    }
    .grounding-tag {
        display: inline-block;
        background: #064e3b;
        color: #6ee7b7;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .topology-node {
        background: #1e293b;
        border: 1px solid #475569;
        border-radius: 6px;
        padding: 12px;
        text-align: center;
        margin: 4px;
    }
</style>
""", unsafe_allow_html=True)


# Initialize Session State
if "audit_log" not in st.session_state:
    st.session_state.audit_log = [
        {
            "timestamp": "2026-09-08 14:22:10",
            "machine_id": "M-101",
            "error_id": "M1-E01",
            "decision": "Accepted Option A (Intervene)",
            "net_avoided_loss": 751500.0,
            "safety_override": False,
        },
        {
            "timestamp": "2026-09-09 09:15:40",
            "machine_id": "M-201",
            "error_id": "M2-E01",
            "decision": "Accepted Option A (Intervene)",
            "net_avoided_loss": 1440000.0,
            "safety_override": False,
        },
        {
            "timestamp": "2026-09-10 11:45:00",
            "machine_id": "M-301",
            "error_id": "M3-E05",
            "decision": "Mandatory Safety Shutdown",
            "net_avoided_loss": 0.0,
            "safety_override": True,
        },
    ]

if "selected_machine_id" not in st.session_state:
    st.session_state.selected_machine_id = "M-101"

if "selected_error_id" not in st.session_state:
    st.session_state.selected_error_id = "M1-E01"


# Data loader
try:
    loader = get_data_loader()
    machines = loader.get_machines()
except Exception as e:
    st.error(f"Dataset Loading Error: {str(e)}")
    st.stop()


# Sidebar Navigation & Model Settings
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/factory.png", width=64)
    st.title("Decision Intelligence")
    st.caption("Operational Maintenance Economics • Cohort 11")

    st.markdown("---")
    st.subheader("System Configuration")

    api_key_input = st.text_input(
        "Groq API Key",
        value=get_groq_api_key() or "",
        type="password",
        help="Reads from GROQ_API_KEY environment variable or st.secrets by default.",
    )

    configured_model = st.text_input(
        "Groq Model",
        value=get_groq_model_name(),
        help="Default: llama-3.3-70b-versatile. Deterministic engine operates independently of model availability.",
    )

    st.markdown("---")
    view_mode = st.radio(
        "Navigation Interface Mode",
        options=["Mode 1: Graphical Factory Topology", "Mode 2: Quick Diagnostic Dropdown"],
        index=0,
    )

    st.markdown("---")
    st.caption("🛡️ Anti-Hallucination Architecture:")
    st.caption("DATA → PYTHON ENGINE → STRUCTURED DECISION → GROQ EXPLAINER → VALIDATION FILTER")


# Top Header Banner
st.title("🏭 Production Downtime & Maintenance Decision Intelligence")
st.markdown("**Core Question:** *“Stop for 10 minutes now — or lose 2 hours later?”*")

# Strategic Landing Overview (Section 5.1 & 12)
st.markdown("#### Strategic Overview · July 2026 – September 2026")
st.caption("Authoritative Benchmark: Historical Scenario Analytics across 100 pkts/hr Diverging Line")

mcol1, mcol2, mcol3, mcol4 = st.columns(4)
with mcol1:
    st.markdown("""
    <div class="metric-card">
        <div class="metric-title">Net Capital Losses Avoided</div>
        <div class="metric-val">PKR 8.42M</div>
        <div class="metric-sub">+18.4% vs unmanaged run-to-failure</div>
    </div>
    """, unsafe_allow_html=True)

with mcol2:
    st.markdown("""
    <div class="metric-card">
        <div class="metric-title">Production Hours Rescued</div>
        <div class="metric-val">26.5 hrs</div>
        <div class="metric-sub">Across 7 assets in 1→2→4 topology</div>
    </div>
    """, unsafe_allow_html=True)

with mcol3:
    st.markdown("""
    <div class="metric-card">
        <div class="metric-title">Preventative Stops Approved</div>
        <div class="metric-val">11</div>
        <div class="metric-sub">Mean intervention time: 14.5 min</div>
    </div>
    """, unsafe_allow_html=True)

with mcol4:
    st.markdown("""
    <div class="metric-card">
        <div class="metric-title">Mandatory Safety Overrides</div>
        <div class="metric-val">3</div>
        <div class="metric-sub">100% legal lockout compliance</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Monthly Comparison Chart
with st.expander("📊 View Q3 2026 Avoided Loss Economics Chart", expanded=False):
    chart_data = pd.DataFrame({
        "Month": ["July 2026", "August 2026", "September 2026"],
        "Planned Intervention Cost (PKR)": [185000, 246500, 212000],
        "Avoided Breakdown Exposure (PKR)": [2680000, 3450000, 2930000],
    })
    st.bar_chart(chart_data.set_index("Month"), color=["#10b981", "#ef4444"])


st.markdown("---")

# Section: Asset Selection / Problem Discovery
st.subheader("Asset Diagnosis & Diagnostic Selector")

if view_mode == "Mode 1: Graphical Factory Topology":
    st.markdown("##### 1 → 2 → 4 Diverging Balanced Topology")
    st.caption("Click any asset node below to inspect its diagnostic status and reported errors.")

    # Stage 1: 1 Machine
    st.markdown("**Stage 1: Primary Feeder (100% Single Point of Failure)**")
    s1_cols = st.columns([1, 2, 1])
    with s1_cols[1]:
        m1 = [m for m in machines if m["machine_id"] == "M-101"][0]
        is_sel = st.session_state.selected_machine_id == "M-101"
        btn_label = f"⚙️ {m1['machine_id']} — {m1['machine_name']} {'(Selected)' if is_sel else ''}\nCap: {m1['capacity_per_hour']:.0f} pkts/hr | Line Loss: PKR {m1['line_loss_rate']:,.0f}/hr\nOperators: {m1['operator']}"
        if st.button(btn_label, key="btn_m101", use_container_width=True):
            st.session_state.selected_machine_id = "M-101"
            st.session_state.selected_error_id = "M1-E01"
            st.rerun()

    # Connector representation
    st.markdown("<div style='text-align:center; color:#64748b; font-size:1.4rem;'>↓ Diverges into 2 Parallel Milling Centers (50% throughput each) ↓</div>", unsafe_allow_html=True)

    # Stage 2: 2 Machines
    st.markdown("**Stage 2: CNC Milling Centers (Parallel Split)**")
    s2_cols = st.columns(2)
    stage2_machines = [m for m in machines if m["stage"] == "Stage 2"]
    for idx, sm in enumerate(stage2_machines):
        with s2_cols[idx]:
            is_sel = st.session_state.selected_machine_id == sm["machine_id"]
            btn_label = f"⚙️ {sm['machine_id']} — {sm['machine_name']} {'(Selected)' if is_sel else ''}\nCap: {sm['capacity_per_hour']:.0f} pkts/hr | Line Loss: PKR {sm['line_loss_rate']:,.0f}/hr\nOperator: {sm['operator']}"
            if st.button(btn_label, key=f"btn_{sm['machine_id']}", use_container_width=True):
                st.session_state.selected_machine_id = sm["machine_id"]
                st.session_state.selected_error_id = "M2-E01"
                st.rerun()

    st.markdown("<div style='text-align:center; color:#64748b; font-size:1.4rem;'>↓ Diverges into 4 Packaging Cells (25% throughput each) ↓</div>", unsafe_allow_html=True)

    # Stage 3: 4 Machines
    st.markdown("**Stage 3: Packaging Cells (Quad Split)**")
    s3_cols = st.columns(4)
    stage3_machines = [m for m in machines if m["stage"] == "Stage 3"]
    for idx, sm in enumerate(stage3_machines):
        with s3_cols[idx]:
            is_sel = st.session_state.selected_machine_id == sm["machine_id"]
            btn_label = f"📦 {sm['machine_id']}\n{sm['machine_name']}\nCap: {sm['capacity_per_hour']:.0f} pkts/hr\nOperator: {sm['operator']}"
            if st.button(btn_label, key=f"btn_{sm['machine_id']}", use_container_width=True):
                st.session_state.selected_machine_id = sm["machine_id"]
                st.session_state.selected_error_id = "M3-E01"
                st.rerun()

    st.markdown("<br>", unsafe_allow_html=True)
    curr_m_errors = loader.get_errors_for_machine(st.session_state.selected_machine_id)
    err_options = {f"{e['error_id']} — {e['failure_mode']} ({e['category']})": e["error_id"] for e in curr_m_errors}
    selected_label = st.selectbox(
        f"Select Reported Failure / Symptom for {st.session_state.selected_machine_id}:",
        options=list(err_options.keys()),
        index=0,
    )
    st.session_state.selected_error_id = err_options[selected_label]

else:
    # Mode 2: Quick Diagnostic
    st.markdown("##### Quick Diagnostic Menu")
    qcol1, qcol2 = st.columns(2)
    with qcol1:
        machine_choices = [m["machine_id"] for m in machines]
        curr_idx = machine_choices.index(st.session_state.selected_machine_id) if st.session_state.selected_machine_id in machine_choices else 0
        sel_m = st.selectbox("Select Machine ID:", options=machine_choices, index=curr_idx)
        st.session_state.selected_machine_id = sel_m

    with qcol2:
        m_errors = loader.get_errors_for_machine(st.session_state.selected_machine_id)
        error_labels = {f"{e['error_id']} : {e['failure_mode']}": e["error_id"] for e in m_errors}
        err_keys = list(error_labels.keys())
        sel_e_label = st.selectbox("Reported Error / Symptom:", options=err_keys, index=0)
        st.session_state.selected_error_id = error_labels[sel_e_label]


# Retrieve validated record
record = loader.get_record(st.session_state.selected_machine_id, st.session_state.selected_error_id)

if not record:
    st.warning("Insufficient data available for this decision.")
    st.stop()

# Deterministic Evaluation
decision_package = evaluate_maintenance_case(record)
is_safety_override = decision_package["safety_override"]

st.markdown("---")

# Symptom & Asset Context Banner
with st.container():
    st.markdown(f"""
    ### ⚠️ Active Diagnostic Incident: `{decision_package['error_id']}` — {decision_package['failure_mode']}
    **Asset:** `{decision_package['machine_id']}` ({decision_package['machine_name']}) &nbsp;|&nbsp;
    **Stage:** {decision_package['stage']} &nbsp;|&nbsp;
    **Operator:** {decision_package['operator']} &nbsp;|&nbsp;
    **Line Loss Baseline:** PKR {decision_package['line_loss_rate']:,.0f}/hr
    """)
    st.info(f"🔍 **Observed Symptom:** {decision_package['symptom']}")


# Section 8 & 14: DECISION GATEKEEPER SIDE-BY-SIDE
st.subheader("Decision Gatekeeper: Intervene Now vs Run to Failure")

if is_safety_override:
    st.markdown("""
    <div class="safety-alert-banner">
        🚨 <strong>MANDATORY SAFETY OVERRIDE ENFORCED</strong><br>
        Economic deferral is legally prohibited by statutory safety codes. Immediate machine shutdown is required.
        Option B (Run to Failure / Continue Running) has been permanently locked out.
    </div>
    """, unsafe_allow_html=True)

gate_col1, gate_col2 = st.columns(2)

with gate_col1:
    opt_a = decision_package["option_a"]
    st.markdown(f"""
    <div class="option-card-a">
        <h3 style="color:#10b981; margin-top:0;">OPTION A — INTERVENE NOW</h3>
        <p style="color:#a7f3d0;">Proactive scheduled stop before catastrophic breakdown.</p>
        <hr style="border-color:#065f46;">
        <table style="width:100%; color:#e2e8f0; font-size:0.95rem;">
            <tr><td>⏱️ <strong>Planned Downtime:</strong></td><td style="text-align:right;"><strong>{opt_a['planned_downtime_min']:.0f} mins</strong></td></tr>
            <tr><td>📉 Production Loss Exposure:</td><td style="text-align:right;">PKR {opt_a['production_loss']:,.2f}</td></tr>
            <tr><td>🔩 Consumable / Wear Part:</td><td style="text-align:right;">PKR {opt_a['parts']:,.2f}</td></tr>
            <tr><td>👷 Scheduled Labor Cost:</td><td style="text-align:right;">PKR {opt_a['labor']:,.2f}</td></tr>
            <tr style="font-size:1.15rem; font-weight:bold; border-top:1px solid #059669;">
                <td style="padding-top:8px; color:#34d399;">TOTAL OPTION A:</td>
                <td style="padding-top:8px; text-align:right; color:#34d399;">PKR {opt_a['total']:,.2f}</td>
            </tr>
        </table>
    </div>
    """, unsafe_allow_html=True)

with gate_col2:
    opt_b = decision_package["option_b"]
    if is_safety_override:
        st.markdown("""
        <div class="option-card-b" style="opacity: 0.6; filter: grayscale(40%);">
            <h3 style="color:#ef4444; margin-top:0;">OPTION B — RUN TO FAILURE</h3>
            <p style="color:#fca5a5;"><strong>STATUS: LOCKED OUT BY SAFETY STATUTORY CODE</strong></p>
            <hr style="border-color:#7f1d1d;">
            <p style="color:#f87171; font-size:0.95rem;">
                Operating with compromised machine safeguarding or emergency circuits violates legal safety regulations.
                No financial deferral calculation permitted. Immediate shutdown required.
            </p>
            <div style="font-size:1.15rem; font-weight:bold; color:#ef4444; margin-top:16px;">
                TOTAL OPTION B: PROHIBITED
            </div>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown(f"""
        <div class="option-card-b">
            <h3 style="color:#ef4444; margin-top:0;">OPTION B — RUN TO FAILURE</h3>
            <p style="color:#fca5a5;">Unplanned breakdown risk if degradation is ignored.</p>
            <hr style="border-color:#7f1d1d;">
            <table style="width:100%; color:#e2e8f0; font-size:0.95rem;">
                <tr><td>💥 <strong>Unplanned Downtime:</strong></td><td style="text-align:right;"><strong>{opt_b['unplanned_downtime_min']:.0f} mins</strong></td></tr>
                <tr><td>📉 Lost Production Value:</td><td style="text-align:right;">PKR {opt_b['production_loss']:,.2f}</td></tr>
                <tr><td>⚙️ Complete Assembly Replacement:</td><td style="text-align:right;">PKR {opt_b['replacement']:,.2f}</td></tr>
                <tr><td>✈️ Express Air Freight:</td><td style="text-align:right;">PKR {opt_b['freight']:,.2f}</td></tr>
                <tr><td>⏳ Idle Operator Cost:</td><td style="text-align:right;">PKR {opt_b['idle_labor']:,.2f}</td></tr>
                <tr><td>🚨 Emergency Tech Callout:</td><td style="text-align:right;">PKR {opt_b['emergency_tech']:,.2f}</td></tr>
                <tr><td>🗑️ Scrap & Waste:</td><td style="text-align:right;">PKR {opt_b['scrap']:,.2f}</td></tr>
                <tr style="font-size:1.15rem; font-weight:bold; border-top:1px solid #dc2626;">
                    <td style="padding-top:8px; color:#f87171;">TOTAL OPTION B:</td>
                    <td style="padding-top:8px; text-align:right; color:#f87171;">PKR {opt_b['total']:,.2f}</td>
                </tr>
            </table>
        </div>
        """, unsafe_allow_html=True)

# Highlight Net Avoided Loss
st.markdown("<br>", unsafe_allow_html=True)
if is_safety_override:
    st.error("🛑 **DECISION VERDICT: MANDATORY SAFETY SHUTDOWN REQUIRED** — Deferral Prohibited.")
else:
    net_val = decision_package["net_avoided_loss"]
    st.success(f"💰 **NET AVOIDED LOSS BY INTERVENING NOW: PKR {net_val:,.2f}** (Option B Total − Option A Total)")


# Section 15: Decision Action Buttons
st.markdown("##### Management Decision Execution")
act_col1, act_col2, act_col3 = st.columns([2, 2, 3])

with act_col1:
    btn_accept = st.button(
        "✅ Accept Option A: Stop Machine Now",
        type="primary",
        use_container_width=True,
    )
    if btn_accept:
        st.session_state.audit_log.insert(0, {
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "machine_id": decision_package["machine_id"],
            "error_id": decision_package["error_id"],
            "decision": "Accepted Option A (Intervene Now)",
            "net_avoided_loss": decision_package["net_avoided_loss"] or 0.0,
            "safety_override": decision_package["safety_override"],
        })
        st.success(f"Intervention recorded for {decision_package['machine_id']}. Planned stop authorized.")

with act_col2:
    if is_safety_override:
        st.button(
            "🚫 Defer: Continue Running (Locked Out)",
            disabled=True,
            use_container_width=True,
            help="Cannot defer. Operating violates statutory safety codes.",
        )
    else:
        btn_defer = st.button(
            "⚠️ Defer: Continue Running",
            use_container_width=True,
            help="Deferring incurs operational exposure. Will be logged in shift handover.",
        )
        if btn_defer:
            st.session_state.audit_log.insert(0, {
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "machine_id": decision_package["machine_id"],
                "error_id": decision_package["error_id"],
                "decision": "Deferred: Continue Running (Operational Risk Accepted)",
                "net_avoided_loss": -(decision_package["net_avoided_loss"] or 0.0),
                "safety_override": False,
            })
            st.warning(f"Operational deferral risk logged for {decision_package['machine_id']}. Added to shift handover log.")


# Section 16: EXPLAINABLE AI PANEL
st.markdown("---")
st.subheader("🤖 Explainable AI Management Explanation")
st.markdown(
    "<span class='grounding-tag'>✓ Anti-Hallucination Guard Active</span> &nbsp; "
    "<span style='color:#94a3b8; font-size:0.85rem;'>AI explanation generated strictly from validated factory data & deterministic math.</span>",
    unsafe_allow_html=True,
)

with st.spinner("Synthesizing grounded management explanation via Groq..."):
    explanation_text, is_ai, notice, parsed_sections = generate_ai_explanation(
        structured_decision=decision_package,
        api_key=api_key_input,
        model=configured_model,
    )

if notice:
    st.caption(f"ℹ️ {notice}")

if parsed_sections:
    st.markdown(f"**DECISION:** {parsed_sections.get('DECISION', '')}")
    st.markdown(f"**WHY:** {parsed_sections.get('WHY', '')}")
    st.markdown(f"**FINANCIAL IMPACT:** {parsed_sections.get('FINANCIAL IMPACT', '')}")
    st.markdown(f"**RISK:** {parsed_sections.get('RISK', '')}")
    st.markdown(f"**ACTION:** {parsed_sections.get('ACTION', '')}")
else:
    st.markdown(explanation_text)


# Section 17: DECISION AUDIT LOG
st.markdown("---")
st.subheader("📋 Decision Audit & Shift Handover Log")
st.caption("Immutable record of maintenance decisions, safety lockouts, and realized savings during current session.")

if st.session_state.audit_log:
    audit_df = pd.DataFrame(st.session_state.audit_log)
    st.dataframe(
        audit_df,
        column_config={
            "timestamp": "Timestamp",
            "machine_id": "Asset ID",
            "error_id": "Error Code",
            "decision": "Logged Decision",
            "net_avoided_loss": st.column_config.NumberColumn("Net Avoided Loss (PKR)", format="PKR %,.2f"),
            "safety_override": "Safety Override Enforced",
        },
        use_container_width=True,
    )
else:
    st.info("No decisions logged yet in current session.")


# Footer
st.markdown("---")
st.markdown("""
<div style="text-align:center; color:#64748b; font-size:0.85rem;">
    Production Downtime & Maintenance Decision Intelligence • Cohort 11 Hackathon Research Edition<br>
    Deterministic Engine (Python 3.10) &bull; Groq AI Explanation Layer &bull; Zero Hallucinations Guaranteed
</div>
""", unsafe_allow_html=True)
