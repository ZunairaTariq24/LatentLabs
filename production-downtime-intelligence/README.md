# Production Downtime & Maintenance Decision Intelligence
### Hackathon Research Edition • Cohort 11 Prototype
> **"Stop for 10 minutes now — or lose 2 hours later?"**

An explainable, deterministic maintenance economics decision-support platform that translates technical mechanical/electrical degradation into an indisputable management business case: **Option A (Intervene Now)** versus **Option B (Run to Failure / Repair Later)**.

---

## 1. System Architecture & Anti-Hallucination Pipeline

In industrial manufacturing, maintenance engineers detect technical degradation (e.g. seal weeping, bearing wear, sensor jitter), but production managers often hesitate to stop a running line due to immediate visible shift losses. 

This application bridges that impasse **without allowing AI to hallucinate or fabricate facts or numbers**:

```
 ┌────────────────┐
 │  FACTORY DATA  │ (Authoritative CSV: 15 Scenarios)
 └───────┬────────┘
         │
         ▼
 ┌────────────────┐
 │ PYTHON ENGINE  │ (Auditable Formulas, Zero LLM Math)
 │  calculator.py │ ──► Option A Total = Downtime Loss + Parts + Labor
 │  data_loader.py│ ──► Option B Total = Downtime Loss + Replace + Freight + Idle + Scrap
 │  validators.py │ ──► Net Avoided Loss = Option B - Option A
 └───────┬────────┘ ──► Safety Lockout Check (M1-E04, M2-E05, M3-E05)
         │
  STRUCTURED VALIDATED
     DECISION JSON
         │
         ▼
 ┌────────────────┐
 │  GROQ AI LAYER │ (Only translates validated facts to management language)
 │  ai_engine.py  │ (Strict System Prompt + Anti-Hallucination Validator)
 └───────┬────────┘
         │
  VERIFIED AUDITABLE
     EXPLANATION
         │
         ▼
 ┌────────────────┐
 │  STREAMLIT UI  │ (Dual-Mode: 1→2→4 Topology & Quick Diagnostic)
 │     app.py     │ (Decision Gatekeeper, Audit Log, Historical Analytics)
 └────────────────┘
```

---

## 2. 1 → 2 → 4 Factory Topology

The manufacturing line operates an end-to-end diverging tree producing **100 packets per hour**:

1. **Stage 1: Primary Feeder (M-101 — Hydraulic Stamping Press)**
   - Capacity: 100 pkts/hr (Feeds entire plant)
   - Operators: Tariq M. (Lead Operator) / Kashif R. (Press Feeder)
   - Baseline Line Loss Rate: **PKR 180,000/hr**
   - Impact: Single point of failure. If M-101 trips, **100% of plant output is lost immediately**.
2. **Stage 2: CNC Milling Centers (M-201 & M-202)**
   - Capacity: 50 pkts/hr each (100 pkts/hr combined)
   - Operators: Salman A. (M-201) / Imran P. (M-202)
   - Baseline Line Loss Rate: **PKR 120,000/hr per machine**
   - Impact: Parallel split. If one trips, the other continues; throughput drops by **50%** and downstream cells starve.
3. **Stage 3: Packaging Cells (M-301, M-302, M-303, M-304)**
   - Capacity: 25 pkts/hr each (100 pkts/hr combined)
   - Operators: Zahid H. (Line A: M-301/M-302) / Bilal N. (Line B: M-303/M-304)
   - Baseline Line Loss Rate: **PKR 45,000/hr per cell**
   - Impact: Quad split. If one cell trips, throughput drops by **25%**; other three remain online.

---

## 3. Authoritative 15-Scenario Master Matrix

| Error ID | Machine | Failure Mode & Category | Option A (Intervene) | Option B (Run-to-Failure) | Net Avoided Loss | Safety Override |
|---|---|---|---|---|---|---|
| **M1-E01** | M-101 | Hydraulic Seal Weeping (Mech) | PKR 56,500 | PKR 808,000 | **+PKR 751,500** | Standard |
| **M1-E02** | M-101 | Motor Terminal Overheating (Elec) | PKR 36,500 | PKR 622,000 | **+PKR 585,500** | Standard |
| **M1-E03** | M-101 | Flywheel Bushing Wear (Mech) | PKR 76,000 | PKR 1,229,000 | **+PKR 1,153,000** | Standard |
| **M1-E04** | M-101 | Light Curtain Alignment (Safety) | PKR 37,000 | **LOCKED OUT** | **Mandatory Action** | **MANDATORY OVERRIDE** |
| **M1-E05** | M-101 | Punch Die Micro-Cracking (Mech) | PKR 98,000 | PKR 1,356,000 | **+PKR 1,258,000** | Standard |
| **M2-E01** | M-201/202 | Ceramic Bearing Wear (Mech) | PKR 79,000 | PKR 1,519,000 | **+PKR 1,440,000** | Standard |
| **M2-E02** | M-201/202 | Servo Encoder Jitter (Elec) | PKR 47,500 | PKR 777,000 | **+PKR 729,500** | Standard |
| **M2-E03** | M-201/202 | Pump Cavitation (Mech) | PKR 28,000 | PKR 441,800 | **+PKR 413,800** | Standard |
| **M2-E04** | M-201/202 | Solenoid Overheating (Elec) | PKR 30,000 | PKR 781,200 | **+PKR 751,200** | Standard |
| **M2-E05** | M-201/202 | Enclosure Interlock Fault (Safety) | PKR 31,500 | **LOCKED OUT** | **Mandatory Action** | **MANDATORY OVERRIDE** |
| **M3-E01** | M-301..304 | Conveyor Belt Skew (Mech) | PKR 18,750 | PKR 207,500 | **+PKR 188,750** | Standard |
| **M3-E02** | M-301..304 | Vacuum Sensor Drift (Elec) | PKR 14,000 | PKR 224,250 | **+PKR 210,250** | Standard |
| **M3-E03** | M-301..304 | Nozzle Carbonization (Mech) | PKR 15,500 | PKR 231,300 | **+PKR 215,800** | Standard |
| **M3-E04** | M-301..304 | Scanner Link Timeout (Elec) | PKR 16,500 | PKR 259,000 | **+PKR 242,500** | Standard |
| **M3-E05** | M-301..304 | E-Stop Ground Fault (Safety) | PKR 16,000 | **LOCKED OUT** | **Mandatory Action** | **MANDATORY OVERRIDE** |

---

## 4. Mandatory Safety Overrides

For **M1-E04**, **M2-E05**, and **M3-E05**:
- Option B is **completely locked out**.
- The `[Defer: Continue Running]` button is **disabled**.
- Prominent industrial alert: `MANDATORY SAFETY OVERRIDE: Economic deferral prohibited by safety statutory codes. Immediate shutdown is required.`
- The Groq AI explanation strictly reinforces statutory compliance and is forbidden from suggesting deferral.

---

## 5. Team Role Allocation (Cohort 11 Hackathon)

| Team Member | Role | Core Responsibility |
|---|---|---|
| **Member 1** | Pitch Specialist | Pitch narrative, 6-slide deck, 2-minute demo video script & narration |
| **Member 2** | Frontend UI/UX Engineer | Streamlit layout (`app.py`), custom high-contrast CSS, topological cards |
| **Member 3** | Backend & Logic Engineer | Deterministic calculator (`calculator.py`), formula test suite, cloud deployment |
| **Member 4** | AI & Prompt Engineer | Groq integration (`ai_engine.py`), system prompt, anti-hallucination validation |
| **Member 5** | Data & QA Specialist | Master CSV dataset (`factory_data.csv`), test coverage for all 15 scenarios |
| **Member 6** | Product & Operations Lead | Business case articulation, audit trail compliance, shift handover logging |

---

## 6. Quick Start & Deployment Guide

### Local Development:
```bash
# 1. Clone repository & enter directory
git clone <repo-url>
cd production-downtime-intelligence

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install minimal dependencies
pip install -r requirements.txt

# 4. Configure Groq API Key
cp .env.example .env
# Edit .env and enter your free key from https://console.groq.com

# 5. Run Verification Tests (100% pass across all 15 scenarios)
python3 test_suite.py

# 6. Launch Streamlit Application
streamlit run app.py
```

### Streamlit Cloud Deployment:
1. Push this folder to a GitHub repository.
2. Sign in to [share.streamlit.io](https://share.streamlit.io).
3. Connect your repository, set `app.py` as main file path.
4. Under **Advanced Settings → Secrets**, add:
   ```toml
   GROQ_API_KEY = "your_groq_api_key_here"
   GROQ_MODEL = "llama-3.3-70b-versatile"
   ```
5. Click **Deploy!** The app runs out of the box with zero additional configuration.
