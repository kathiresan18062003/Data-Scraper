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
import { SheetInfo, UploadResponse } from '../types';

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
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const effectiveGeminiAvailable = Boolean(geminiAvailable || geminiKeyInput.trim());
  const [useGemini, setUseGemini] = useState(effectiveGeminiAvailable);
  const [periodicSave, setPeriodicSave] = useState(true);
  const [saveEvery, setSaveEvery] = useState(1);

  const [starting, setStarting] = useState(false);
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

  const handleStartScraping = async () => {
    if (!uploadData || !currentSheet) {
      setError('Please upload an Excel workbook first.');
      return;
    }

    if (!colMapping.mpn1 && !colMapping.mpn) {
      setError('Please map either the MPN1 (primary) or MPN column to identify products.');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      if (geminiKeyInput.trim()) {
        localStorage.setItem('gemini_api_key', geminiKeyInput.trim());
      }

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
        gemini_api_key: geminiKeyInput.trim() || undefined,
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
                    const next = e.target.checked;
                    setUseGemini(next);
                    if (next && !effectiveGeminiAvailable) {
                      setShowKeyInput(true);
                    }
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
                  {effectiveGeminiAvailable
                    ? 'Active (Fills missing specs)'
                    : 'Deterministic mode (no key)'}
                </span>
                {!effectiveGeminiAvailable && (
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="text-purple-600 hover:text-purple-700 font-semibold underline ml-1"
                  >
                    {showKeyInput ? 'Hide' : '+ Add Key'}
                  </button>
                )}
              </div>

              {showKeyInput && (
                <div className="mt-2 space-y-1">
                  <input
                    type="password"
                    placeholder="Paste Gemini API key (AIzaSy...)"
                    value={geminiKeyInput}
                    onChange={(e) => {
                      setGeminiKeyInput(e.target.value);
                      if (e.target.value.trim()) {
                        setUseGemini(true);
                      }
                    }}
                    className="w-full px-2 py-1 text-xs border border-purple-300 rounded font-mono"
                  />
                  <span className="text-[10px] text-purple-600 block">Key stored in browser for this scrape</span>
                </div>
              )}
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
        <div className="flex justify-end">
          <button
            onClick={handleStartScraping}
            disabled={starting}
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
      )}
    </div>
  );
};
