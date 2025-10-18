# Time Series Anomaly Detection Dashboard

A comprehensive web application for analyzing time series data with anomaly detection capabilities, featuring interactive charts, data filtering, and collaborative note-taking functionality.

## 🆕 Latest Updates

- **Clean UI**: Removed unnecessary "Click STATIC to activate" text for cleaner interface
- **Optimized Performance**: Removed ETL time check code from backend for better performance
- **Enhanced Notes**: Multi-line notes with auto-save and user attribution
- **Excel Export**: Fixed column ordering and integrated Notes data
- **Column Management**: Drag-and-drop column reordering and pinning
- **Chart Loading**: Lazy loading with progress tracking

## 🏗️ Architecture Overview

This project consists of a **FastAPI backend** and a **React TypeScript frontend** that work together to provide a powerful data analysis platform.

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Data Storage  │
│   (React TS)    │◄──►│   (FastAPI)     │◄──►│   (Parquet)     │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • API Endpoints │    │ • Chart Data    │
│ • Charts        │    │ • Data Loading  │    │ • Notes DB      │
│ • Notes         │    │ • Notes API     │    │ • Filter Data   │
│ • Excel Export  │    │ • CORS Support  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
ts_f/
├── backend/                    # FastAPI Backend
│   ├── api.py                 # Main API server
│   ├── db.py                  # Database operations
│   ├── data_loader.py         # Parquet data loading
│   ├── notes.db               # SQLite notes database
│   └── temp/chart_data/       # Parquet data files (100 tasks)
├── frontend/                   # React TypeScript Frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── charts/       # Chart components
│   │   │   ├── table/        # Table components
│   │   │   └── *.tsx         # UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── styles/           # CSS styles
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   ├── package.json          # Node.js dependencies
│   └── tsconfig.json         # TypeScript config
├── chart_data/               # Main data directory
│   └── TASK*.parquet         # Time series data files
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
cd backend
python api.py
```
The backend will be available at `http://localhost:8050`

### Frontend Setup
```bash
# Install Node.js dependencies
cd frontend
npm install

# Start the development server
npm run dev
```
The frontend will be available at `http://localhost:5173`

## 🎯 Key Features

### 📊 Interactive Data Visualization
- **Time Series Charts**: 30-day and 60-day interactive charts using ECharts
- **Lazy Loading**: Charts load on-demand for better performance
- **Interactive Mode**: Click STATIC button to activate zoom/pan controls
- **Static Mode**: Fast rendering for overview
- **Clean Interface**: Streamlined UI without unnecessary text overlays

### 🔍 Advanced Filtering
- **Multi-dimensional Filters**: Line, Area, Equipment, Parameter filtering
- **Real-time Search**: Instant filtering as you type
- **Pagination**: Efficient data browsing with configurable page sizes
- **Caching**: Smart caching for improved performance

### 📝 Collaborative Notes System
- **Multi-line Notes**: Rich text input with line breaks
- **User Attribution**: Track who created/updated notes
- **Real-time Saving**: Auto-save on blur events
- **Metadata Display**: Show creation/update timestamps

### 📋 Data Management
- **Excel Export**: Export data with charts and notes to Excel
- **Column Management**: Show/hide, reorder, and pin columns
- **Responsive Design**: Works on desktop and mobile devices
- **Performance Optimized**: Efficient data loading and rendering

## 🛠️ Technical Stack

### Backend Technologies
- **FastAPI**: Modern Python web framework
- **Pandas**: Data manipulation and analysis
- **SQLite**: Lightweight database for notes
- **Parquet**: Efficient columnar data format
- **Pydantic**: Data validation and serialization

### Frontend Technologies
- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe JavaScript
- **TanStack Table**: Powerful table component
- **ECharts**: Interactive charting library
- **React Query**: Data fetching and caching
- **ExcelJS**: Excel file generation

### Key Libraries
- **React Query**: Server state management
- **React Hook Form**: Form handling
- **Axios**: HTTP client
- **Tailwind CSS**: Utility-first CSS framework

## 📊 Data Schema

### V2 Schema (Current)
```typescript
interface TaskData {
  MASTER_TASK_ID: string;      // Primary identifier
  LINE: string;               // Production line
  AREA: string;               // Area code
  PROD_EQP_ID: string;        // Equipment ID
  PARAM_SUBITEM: string;      // Parameter name
  PPID: string;               // Process ID
  RECIPEID: string;           // Recipe ID
  CH_STEP: string;            // Step number
  MODEL_RESULT_INFO: string;  // AI result
  COMMENTS: string;           // Comments
  plot_data: {               // Chart data
    act_date: number[];       // Timestamps
    value: number[];          // Values
    spec_lower: number[];     // Lower spec
    spec_upper: number[];     // Upper spec
  };
}
```

### Notes Schema
```typescript
interface NoteData {
  note: string;              // Note content
  created_at: string;        // Creation timestamp
  updated_at: string;        // Update timestamp
  created_by: string;        // Creator user ID
  updated_by: string;        // Last updater user ID
}
```

## 🔧 API Endpoints

### Data Endpoints
- `GET /filters/options` - Get available filter options
- `POST /data/query` - Query data with filters and pagination
- `GET /data/chart/{task_id}` - Get chart data for specific task

### Notes Endpoints
- `POST /notes/save` - Save a note
- `POST /notes/load` - Load notes for multiple tasks
- `GET /notes/load/{user_id}` - Load all notes for a user

## 🎨 UI Components

### Core Components
- **DashboardTable**: Main data table with sorting, filtering, pagination
- **LazyChart**: Interactive time series charts
- **NotesInput**: Multi-line notes input with auto-save
- **ColumnSettingsModal**: Column management interface
- **UserIdModal**: User authentication modal

### Chart Features
- **Static Mode**: Fast rendering for overview
- **Interactive Mode**: Zoom, pan, and data exploration
- **Lazy Loading**: Load charts on-demand
- **Progress Tracking**: Visual loading progress

## 📈 Performance Optimizations

### Frontend Optimizations
- **React.memo**: Prevent unnecessary re-renders
- **Lazy Loading**: Load charts only when needed
- **Caching**: React Query for data caching
- **Debouncing**: Optimize search and input handling
- **Virtual Scrolling**: Efficient large dataset rendering

### Backend Optimizations
- **Parquet Format**: Efficient columnar storage
- **Pagination**: Limit data transfer
- **Caching**: Smart data caching
- **Compression**: Gzip middleware for responses

## 🔒 Security Features

- **CORS Configuration**: Secure cross-origin requests
- **Input Validation**: Pydantic models for data validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Sanitized user inputs

## 📱 Responsive Design

- **Mobile-First**: Optimized for mobile devices
- **Flexible Layout**: Adapts to different screen sizes
- **Touch-Friendly**: Optimized for touch interactions
- **Accessibility**: WCAG compliant design

## 🚀 Deployment

### Production Considerations
- **Environment Variables**: Secure configuration management
- **Database Migration**: Schema versioning
- **Performance Monitoring**: Track API response times
- **Error Handling**: Comprehensive error logging
- **Security Headers**: HTTPS and security headers

### Docker Support
```dockerfile
# Backend Dockerfile
FROM python:3.9-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "api.py"]

# Frontend Dockerfile
FROM node:16-alpine
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in the `/md` directory
- Review the API documentation at `/docs` endpoint
- Create an issue in the repository

---

**Built with ❤️ using React, TypeScript, FastAPI, and modern web technologies.**
