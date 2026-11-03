import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowRight,
  Play,
  Settings2,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';
import { JobPreviewResponse, SheetInfo, UploadResponse } from '../types';

interface UploadPageProps {
  onJobStarted: (jobId: string) => void;
  geminiAvailable: boolean;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onJobStarted, geminiAvailable }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);

  // Column mapping state
  const [colMapping, setColMapping] = useState<{
    sno: string;
    mpn1: string;
    mpn: string;
    mfr: string;
    title: string;
    upc: string;
    url: string;
  }>({ sno: '', mpn1: '', mpn: '', mfr: '', title: '', upc: '', url: '' });

  // Processing scope & range state
  const [processScope, setProcessScope] = useState<'all' | 'range'>('all');
  const [rangeMode, setRangeMode] = useState<'sno' | 'row'>('sno');
  const [rangeStart, setRangeStart] = useState<string>('1');
  const [rangeEnd, setRangeEnd] = useState<string>('50');

  // Job config state
  const [limit, setLimit] = useState<number | ''>('');
  const [timeout, setTimeoutVal] = useState(() => Number(localStorage.getItem('scraper_timeout') || 20));
  const [retries, setRetries] = useState(() => Number(localStorage.getItem('scraper_retries') || 2));
  const [useGemini, setUseGemini] = useState(true);
  const [periodicSave, setPeriodicSave] = useState(true);
  const [saveEvery, setSaveEvery] = useState(1);

  const [starting, setStarting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preflight, setPreflight] = useState<JobPreviewResponse | null>(null);
  const [preflightSignature, setPreflightSignature] = useState('');
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const autoMapSheet = (sheet: SheetInfo) => {
    const det = sheet.detected_columns;
    setColMapping({
      sno: det.sno || '',
      mpn1: det.mpn1 || '',
      mpn: det.mpn || sheet.headers[0] || '',
      mfr: det.mfr || sheet.headers[1] || '',
      title: det.title || '',
      upc: det.upc || '',
      url: det.url || '',
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreflight(null);
      setPreflightSignature('');
      setExcludedRows(new Set());
      setError(null);

      setUploading(true);
      try {
        const resp = await api.uploadFile(selectedFile);
        setUploadData(resp);
        if (resp.sheets && resp.sheets.length > 0) {
          setSelectedSheetIndex(0);
          autoMapSheet(resp.sheets[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to upload workbook');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSheetChange = (idx: number) => {
    setSelectedSheetIndex(idx);
    if (uploadData?.sheets[idx]) {
      autoMapSheet(uploadData.sheets[idx]);
    }
  };

  const currentSheet: SheetInfo | undefined = uploadData?.sheets[selectedSheetIndex];

  const buildPreviewRequest = () => {
    if (!uploadData || !currentSheet) return null;

    const request = {
      file_token: uploadData.file_token,
      sheet_name: currentSheet.name,
      column_mapping: colMapping,
      limit: limit !== '' ? Number(limit) : null,
      start_row: null as number | null,
      end_row: null as number | null,
      sno_start: null as number | null,
      sno_end: null as number | null,
      exclude_rows: Array.from(excludedRows),
    };
    if (processScope === 'range') {
      const start = parseInt(rangeStart, 10);
      const end = parseInt(rangeEnd, 10);
      if (rangeMode === 'sno') {
        request.sno_start = Number.isNaN(start) ? null : start;
        request.sno_end = Number.isNaN(end) ? null : end;
      } else {
        request.start_row = Number.isNaN(start) ? null : start;
        request.end_row = Number.isNaN(end) ? null : end;
      }
    }
    return request;
  };
  const previewRequest = buildPreviewRequest();
  const currentPreviewSignature = previewRequest ? JSON.stringify(previewRequest) : '';
  const hasCurrentPreflight = Boolean(preflight && preflightSignature === currentPreviewSignature);
  const issueRows = preflight
    ? [...new Set([
        ...preflight.missing_identifier_rows,
        ...preflight.duplicate_rows,
        ...preflight.invalid_gtin_rows,
        ...preflight.missing_manufacturer_rows,
      ])].sort((a, b) => a - b)
    : [];
  const rowWarnings = (row: number) => [
    preflight?.missing_identifier_rows.includes(row) && 'blank product identifier',
    preflight?.duplicate_rows.includes(row) && 'duplicate MPN/manufacturer',
    preflight?.invalid_gtin_rows.includes(row) && 'invalid UPC/GTIN check digit or format',
    preflight?.missing_manufacturer_rows.includes(row) && 'manufacturer is blank',
  ].filter(Boolean).join(', ');

  const handlePreflight = async () => {
    if (!previewRequest) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const result = await api.previewJob(previewRequest);
      setPreflight(result);
      setPreflightSignature(JSON.stringify(previewRequest));
    } catch (err: any) {
      setError(err.message || 'Failed to validate the selected worksheet');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStartScraping = async () => {
    if (!uploadData || !currentSheet) {
      setError('Please upload an Excel workbook first.');
      return;
    }

    if (!colMapping.mpn1 && !colMapping.mpn) {
      setError('Please map either the MPN1 (primary) or MPN column to identify products.');
      return;
    }

    if (!hasCurrentPreflight) {
      setError('Run the preflight check again after changing the worksheet, mapping, or product range.');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      // Build request payload
      const requestPayload: any = {
        file_token: uploadData.file_token,
        sheet_name: currentSheet.name,
        column_mapping: colMapping,
        limit: limit !== '' ? Number(limit) : null,
        timeout: Number(timeout),
        retries: Number(retries),
        use_gemini: Boolean(useGemini),
        save_every: periodicSave ? Number(saveEvery) : 1,
        exclude_rows: Array.from(excludedRows),
      };

      if (processScope === 'range') {
        const startVal = parseInt(rangeStart, 10);
        const endVal = parseInt(rangeEnd, 10);
        if (rangeMode === 'sno') {
          if (!isNaN(startVal)) requestPayload.sno_start = startVal;
          if (!isNaN(endVal)) requestPayload.sno_end = endVal;
        } else {
          if (!isNaN(startVal)) requestPayload.start_row = startVal;
          if (!isNaN(endVal)) requestPayload.end_row = endVal;
        }
      }

      const newJob = await api.createJob(requestPayload);
      onJobStarted(newJob.id);
    } catch (err: any) {
      setError(err.message || 'Failed to start scraping job');
      setStarting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload & Configure Scraping Job</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload your product catalog workbook (.xlsx), map identifiers (MPN1, MPN, Brand, UPC), configure S.No ranges, and execute automated multi-source enrichment.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Upload Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center space-x-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
          <span>Upload Catalog Workbook (.xlsx)</span>
        </h2>

        <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition cursor-pointer relative bg-slate-50/50">
          <input
            type="file"
            accept=".xlsx, .xlsm"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            {file ? file.name : 'Click or drag and drop your Excel workbook here'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Supports .xlsx and .xlsm files up to 50MB (preserves original sheets, order & formatting)
          </p>

          {uploading && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-blue-600 font-semibold">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>Analyzing workbook structure, headers, and rows...</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Worksheet and Preview */}
      {uploadData && currentSheet && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
            <span>Worksheet Selection & 10-Row Preview</span>
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full sm:w-72">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Target Worksheet</label>
              <select
                value={selectedSheetIndex}
                onChange={(e) => handleSheetChange(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                {uploadData.sheets.map((sh, idx) => (
                  <option key={sh.name} value={idx}>
                    {sh.name} ({sh.row_count} rows, {sh.column_count} cols)
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500">
              <span className="font-bold text-slate-800">{currentSheet.row_count}</span> rows available · <span className="font-bold text-slate-800">{currentSheet.headers.length}</span> detected columns
            </div>
          </div>

          {/* Table preview */}
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-2">Workbook Preview (First 10 Rows):</span>
            <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0">
                  <tr>
                    {currentSheet.preview_rows[0]?.map((col, i) => (
                      <th key={i} className="px-3 py-2 whitespace-nowrap bg-slate-100">
                        {String(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {currentSheet.preview_rows.slice(1).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {uploadData && currentSheet && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
            <span>Product Identifier & Column Mapping</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MPN1 (Primary Identifier) */}
            <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-200/60">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                MPN1 (Primary Identifier) <span className="text-blue-600 font-normal text-[11px]">(Recommended)</span>
              </label>
              <select
                value={colMapping.mpn1}
                onChange={(e) => setColMapping({ ...colMapping, mpn1: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None (use MPN) --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Primary model number for search</span>
            </div>

            {/* MPN (Secondary Identifier) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                MPN / Part Number <span className="text-rose-500">*</span>
              </label>
              <select
                value={colMapping.mpn}
                onChange={(e) => setColMapping({ ...colMapping, mpn: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Column --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Base part / SKU number</span>
            </div>

            {/* Manufacturer / Brand */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Manufacturer / Brand <span className="text-rose-500">*</span>
              </label>
              <select
                value={colMapping.mfr}
                onChange={(e) => setColMapping({ ...colMapping, mfr: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Column --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Brand identity verification</span>
            </div>

            {/* S.No / Serial Number */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                S.No / Serial No (Optional)
              </label>
              <select
                value={colMapping.sno}
                onChange={(e) => setColMapping({ ...colMapping, sno: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Auto-generate from row --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Stable product identifier</span>
            </div>

            {/* Product Title Column */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Product Title (Optional)
              </label>
              <select
                value={colMapping.title}
                onChange={(e) => setColMapping({ ...colMapping, title: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Catalog title fallback</span>
            </div>

            {/* UPC / Barcode */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                UPC / Barcode (Optional)
              </label>
              <select
                value={colMapping.upc}
                onChange={(e) => setColMapping({ ...colMapping, upc: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Barcode matching</span>
            </div>

            {/* Existing Source URL */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Direct Source URL (Optional)
              </label>
              <select
                value={colMapping.url}
                onChange={(e) => setColMapping({ ...colMapping, url: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">Prioritized candidate URL</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Scraping Scope & Execution Settings */}
      {uploadData && currentSheet && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
            <span>Batch Scope & Execution Settings</span>
          </h2>

          {/* Processing Scope Selector */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Processing Range & Selection:</span>
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="radio"
                  name="processScope"
                  checked={processScope === 'all'}
                  onChange={() => setProcessScope('all')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Process All Products ({currentSheet.row_count} total)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="radio"
                  name="processScope"
                  checked={processScope === 'range'}
                  onChange={() => setProcessScope('range')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Specific Range Selection</span>
              </label>
            </div>

            {processScope === 'range' && (
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-600 font-medium">Filter by:</span>
                  <select
                    value={rangeMode}
                    onChange={(e: any) => setRangeMode(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs font-semibold"
                  >
                    <option value="sno">S.No</option>
                    <option value="row">Row Number</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-600">From:</span>
                  <input
                    type="number"
                    min={1}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-20 px-2.5 py-1 border border-slate-300 rounded text-xs text-center"
                  />
                  <span className="text-slate-600">To:</span>
                  <input
                    type="number"
                    min={1}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-20 px-2.5 py-1 border border-slate-300 rounded text-xs text-center"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Batch Limit Cap */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Max Products Limit (Optional)</label>
              <input
                type="number"
                min={1}
                max={currentSheet.row_count}
                placeholder={`All (${currentSheet.row_count})`}
                value={limit}
                onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Leave empty to process all</span>
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Request Timeout (s)</label>
              <input
                type="number"
                min={5}
                max={120}
                value={timeout}
                onChange={(e) => setTimeoutVal(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Default 20s</span>
            </div>

            {/* Retries */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Max Retries per Site</label>
              <input
                type="number"
                min={0}
                max={5}
                value={retries}
                onChange={(e) => setRetries(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Retry per attempt</span>
            </div>

            {/* AI Toggle */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={useGemini}
                  onChange={(e) => {
                    setUseGemini(e.target.checked);
                  }}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Google Gemini AI</span>
                </span>
              </label>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {geminiAvailable ? 'Server key configured' : 'No server key; deterministic extraction only'}
                </span>
              </div>
            </div>
          </div>

          {/* Periodic Save */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={periodicSave}
                onChange={(e) => setPeriodicSave(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Simultaneous Live Excel & Checkpoint Saving</span>
                <span className="text-[11px] text-slate-500">Atomically writes outputs and updates progress after every product</span>
              </div>
            </label>

            {periodicSave && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-600">Save every</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={saveEvery}
                  onChange={(e) => setSaveEvery(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center font-bold"
                />
                <span className="text-xs text-slate-600">product(s)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Button */}
      {uploadData && currentSheet && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">5. Preflight Validation & Search Preview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Checks the selected rows and previews search templates without contacting search engines.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePreflight}
                disabled={previewLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {previewLoading ? 'Checking workbook…' : 'Validate & Preview'}
              </button>
            </div>

            {preflight && (
              hasCurrentPreflight ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Products to process', preflight.total_rows],
                      ['Rows excluded', preflight.excluded_rows_count],
                      ['Blank identifiers', preflight.missing_identifier_rows.length],
                      ['Duplicate rows', preflight.duplicate_rows.length],
                      ['Invalid UPC/GTIN', preflight.invalid_gtin_rows.length],
                      ['No manufacturer', preflight.missing_manufacturer_rows.length],
                      ['Existing URLs', preflight.existing_url_rows.length],
                    ].map(([label, count]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{count}</div>
                      </div>
                    ))}
                  </div>
                  {(preflight.missing_identifier_rows.length > 0 ||
                    preflight.duplicate_rows.length > 0 ||
                    preflight.invalid_gtin_rows.length > 0 ||
                    preflight.missing_manufacturer_rows.length > 0) && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Review the listed row numbers before starting. Rows without an identifier are ignored, and duplicate MPN/manufacturer pairs are deduplicated by the job.
                    </p>
                  )}
                  {issueRows.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700">Problem rows — select rows to exclude from this job</h3>
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
                        {issueRows.map((row) => (
                          <label key={row} className="flex items-start gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={excludedRows.has(row)}
                              onChange={(event) => {
                                setExcludedRows((current) => {
                                  const next = new Set(current);
                                  if (event.target.checked) next.add(row);
                                  else next.delete(row);
                                  return next;
                                });
                              }}
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Row {row}: {rowWarnings(row)}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {excludedRows.size} row(s) selected for exclusion. The uploaded workbook itself is not changed.
                      </p>
                    </div>
                  )}
                  {excludedRows.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span>Excluded row(s): {Array.from(excludedRows).sort((a, b) => a - b).join(', ')}</span>
                      {Array.from(excludedRows).map((row) => (
                        <button
                          key={row}
                          type="button"
                          onClick={() => setExcludedRows((current) => {
                            const next = new Set(current);
                            next.delete(row);
                            return next;
                          })}
                          className="rounded border border-slate-300 px-2 py-1 text-blue-700 hover:bg-blue-50"
                        >
                          Include row {row}
                        </button>
                      ))}
                    </div>
                  )}
                  {preflight.query_preview.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700">Example queries (first {preflight.query_preview.length} products)</h3>
                      {preflight.query_preview.map((item) => (
                        <div key={item.row} className="rounded-lg border border-slate-200 p-3">
                          <div className="mb-1 text-xs font-semibold text-slate-800">
                            Row {item.row}: {item.manufacturer} {item.mpn}
                          </div>
                          <ul className="space-y-1">
                            {item.queries.map((query, index) => (
                              <li key={`${item.row}-${index}`} className="break-all text-[11px] text-slate-600">
                                <span className="font-semibold text-blue-700">{query.tier}:</span> {query.query}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-amber-700">The selection changed. Run preflight again to validate the current mapping and range.</p>
              )
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            {!hasCurrentPreflight && (
              <span className="text-xs text-slate-500">Run preflight before starting.</span>
            )}
          <button
            onClick={handleStartScraping}
            disabled={starting || !hasCurrentPreflight}
            className="flex items-center space-x-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition hover:scale-[1.02] disabled:opacity-50 text-sm"
          >
            {starting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Initializing Scraping Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Start Scraping (Live Auto-Save)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          </div>
        </div>
      )}
    </div>
  );
};
