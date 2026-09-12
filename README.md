                  FRONTEND
                     │
                     ▼
                main.py
              API / routing
                     │
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
   PO Service   Invoice Service   Auth
        │            │
        │            ▼
        │       AI Extractor
        │            │
        │            ▼
        │       Audit Engine
        │            │
        └────────────┼─────────────┐
                     ▼             │
                  MySQL ◄──────────┘

# AI Vendor Invoice Audit Platform

An AI-powered B2B vendor invoice auditing system that automates the invoice verification process using machine learning to detect discrepancies, calculate financial exposure, and assess risk scores.

## 🎯 Overview

This platform streamlines the invoice audit workflow between buyers and vendors by:
- **Automating invoice data extraction** using AI (Groq API)
- **Validating invoices against purchase orders** with deterministic rules
- **Detecting discrepancies** in quantity, pricing, and item details
- **Calculating financial exposure** and risk scores
- **Providing real-time audit reports** for informed decision-making

## 🏗️ Architecture

### Tech Stack

**Backend:**
- **FastAPI** - Modern, fast web framework for building APIs
- **MySQL** - Relational database for persistent storage
- **Groq API** - AI-powered invoice text extraction
- **Pydantic** - Data validation using Python type annotations
- **JWT** - Token-based authentication (bcrypt for password hashing)
- **Uvicorn** - ASGI server

**Frontend:**
- **HTML5/CSS3/JavaScript** - Vanilla web technologies
- **Responsive design** - Mobile-friendly interface

**Database:**
- **MySQL 8.0** - Connection pooling for performance

## 📁 Project Structure

```
hackathon/
├── backend/
│   ├── main.py              # FastAPI application & API endpoints
│   ├── auth.py              # Authentication (signup, login, JWT)
│   ├── database.py          # MySQL connection pooling
│   ├── schemas.py           # Pydantic data models
│   ├── ai_extractor.py      # Groq AI invoice extraction
│   ├── audit_engine.py      # Deterministic audit logic
│   ├── invoice_service.py   # Invoice submission workflow
│   └── po_service.py        # Purchase order management
├── frontend/
│   ├── index.html           # Landing page
│   ├── signup.html          # User registration
│   ├── buyer.html           # Buyer dashboard
│   ├── vendor.html          # Vendor dashboard
│   ├── invoices.html        # Invoice管理
│   ├── audit.html           # Audit results display
│   └── js/
│       └── config.js        # Frontend configuration
├── .env                     # Environment variables
├── requirements.txt         # Python dependencies
└── hackathon_db_backup.sql  # Database schema & seed data
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- MySQL 8.0+
- Groq API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd hackathon
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
```env
GROQ_API_KEY=your_groq_api_key
DB_HOST=localhost
DB_PORT=3306
DB_USER=hackathon_user
DB_PASSWORD=your_password
DB_NAME=hackathon_db
JWT_SECRET=your_jwt_secret
```

5. **Setup database**
```bash
# Create database and user
mysql -u root -p < hackathon_db_backup.sql
```

6. **Run the application**
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The application will be available at `http://localhost:8000`

## 🔐 Authentication

The platform supports two user roles:

### Buyers
- Create purchase orders
- View vendor list
- Monitor invoice audits
- Track financial exposure

### Vendors
- Register for approval
- Accept purchase orders
- Submit invoices
- View audit results

**Note:** For the hackathon MVP, the frontend stores `user_id` and `role` in localStorage. JWT authentication is implemented but not enforced on business routes.

## 📊 Database Schema

### Core Tables

**buyers**
- Buyer account information
- Contact details
- Account status (active/pending/blocked)

**vendors**
- Vendor business information
- Owner details
- Approval status (pending/approved/blocked)

**purchase_orders**
- PO number (auto-generated)
- Buyer and vendor relationship
- Item specifications
- Agreed pricing and quantity
- Status (pending/accepted)

**invoices**
- Invoice number
- Linked to purchase order
- Raw invoice text
- Status (submitted/audited)

**invoice_items**
- Line items from invoices
- AI-extracted data
- Quantity and pricing

**audit_logs**
- Audit results
- Discrepancy detection
- Financial exposure calculation
- Risk scoring (0-100)

## 🔌 API Endpoints

### Authentication
- `POST /auth/signup/buyer` - Register buyer account
- `POST /auth/signup/vendor` - Register vendor account
- `POST /auth/login` - User login

### Vendors
- `GET /vendors` - List approved vendors
- `GET /vendors/{vendor_id}` - Get vendor details
- `GET /vendors/{vendor_id}/score` - Vendor risk statistics

### Purchase Orders
- `POST /purchase-orders` - Create purchase order (buyer)
- `GET /purchase-orders` - List buyer's POs
- `GET /purchase-orders/{po_id}` - Get PO details
- `GET /vendor/purchase-orders` - List vendor's POs
- `POST /purchase-orders/{po_id}/accept` - Accept PO (vendor)

### Invoices
- `POST /invoices` - Submit invoice with AI extraction
- `GET /invoices` - List invoices (by vendor or buyer)
- `GET /invoices/{invoice_id}` - Get invoice details with audit

### Audits
- `GET /audits` - List audit logs
- `GET /audits/{audit_id}` - Get detailed audit report

### System
- `GET /` - API status
- `GET /health` - Health check

## 🤖 AI Invoice Extraction

The platform uses Groq API to extract structured data from unstructured invoice text:

**Extracted Fields:**
- PO ID
- Item name
- Quantity delivered
- Unit price charged

**Process:**
1. Vendor submits raw invoice text
2. AI extracts structured data
3. System validates extraction against PO
4. Audit engine compares extracted vs agreed values

## 🔍 Audit Engine

The deterministic audit logic checks for:

### Quantity Discrepancies
- Compares delivered quantity vs expected quantity
- Calculates shortage value

### Price Discrepancies
- Compares charged unit price vs agreed price
- Calculates overcharge value

### Item Mismatches
- Validates item name matches PO specification

### Financial Exposure
```
Financial Exposure = Shortage Value + Overcharge Value
```

### Risk Score (0-100)
- Quantity variance: Up to 50 points
- Price variance: Up to 50 points
- Item mismatch: 25 points

## 📈 Features

### For Buyers
- **Vendor Management** - Browse and select approved vendors
- **PO Creation** - Generate purchase orders with specifications
- **Real-time Monitoring** - Track invoice submissions and audits
- **Risk Assessment** - View vendor performance metrics
- **Financial Control** - Monitor exposure and discrepancies

### For Vendors
- **Easy Registration** - Simple onboarding with approval workflow
- **PO Management** - View and accept purchase orders
- **Invoice Submission** - Submit invoices with AI-powered extraction
- **Audit Transparency** - View detailed audit results
- **Performance Tracking** - Monitor risk scores and compliance

## 🛠️ Development

### Running Tests
```bash
# Add test commands here
pytest
```

### Database Migrations
```bash
# Apply schema changes
mysql -u hackathon_user -p hackathon_db < migrations/001_initial_schema.sql
```

### Adding New Endpoints
1. Define Pydantic schema in `schemas.py`
2. Implement business logic in service module
3. Add endpoint in `main.py`
4. Update frontend if needed

## 🔒 Security Considerations

- **Password Hashing** - bcrypt for secure password storage
- **JWT Tokens** - Token-based authentication (12-hour expiration)
- **SQL Injection Prevention** - Parameterized queries
- **Input Validation** - Pydantic schema validation
- **Role-Based Access** - Buyer/Vendor role separation
- **Vendor Approval** - Manual approval workflow for vendors

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Groq API key for AI extraction | Yes |
| `DB_HOST` | MySQL host address | Yes |
| `DB_PORT` | MySQL port | Yes |
| `DB_USER` | Database username | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify MySQL is running
- Check credentials in `.env`
- Ensure database exists

**AI Extraction Errors**
- Verify Groq API key is valid
- Check invoice text format
- Review API quota limits

**Authentication Issues**
- Clear browser localStorage
- Verify user status (not blocked/pending)
- Check JWT secret configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is developed for the hackathon. Please refer to the license file for usage terms.

## 👥 Team

Built for the Hackathon 2026

## 🙏 Acknowledgments

- Groq API for AI-powered invoice extraction
- FastAPI for the robust web framework
- MySQL for reliable data storage
