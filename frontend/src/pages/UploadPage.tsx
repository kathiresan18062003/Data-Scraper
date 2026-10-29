import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Check, AlertCircle, ArrowRight, Play, Settings2, Sparkles } from 'lucide-react';
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
    mpn: string;
    mfr: string;
    title: string;
    url: string;
  }>({ mpn: '', mfr: '', title: '', url: '' });

  // Job config state
  const [processAll, setProcessAll] = useState(true);
  const [limit, setLimit] = useState(100);
  const [timeout, setTimeoutVal] = useState(20);
  const [retries, setRetries] = useState(2);
  const [useGemini, setUseGemini] = useState(geminiAvailable);
  const [periodicSave, setPeriodicSave] = useState(true);
  const [saveEvery, setSaveEvery] = useState(1);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);

      // Auto upload on select
      setUploading(true);
      try {
        const resp = await api.uploadFile(selectedFile);
        setUploadData(resp);
        if (resp.sheets && resp.sheets.length > 0) {
          const firstSheet = resp.sheets[0];
          setSelectedSheetIndex(0);
          setColMapping({
            mpn: firstSheet.detected_columns.mpn || firstSheet.headers[0] || '',
            mfr: firstSheet.detected_columns.mfr || firstSheet.headers[1] || '',
            title: firstSheet.detected_columns.title || '',
            url: firstSheet.detected_columns.url || '',
          });
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
      const sh = uploadData.sheets[idx];
      setColMapping({
        mpn: sh.detected_columns.mpn || sh.headers[0] || '',
        mfr: sh.detected_columns.mfr || sh.headers[1] || '',
        title: sh.detected_columns.title || '',
        url: sh.detected_columns.url || '',
      });
    }
  };

  const currentSheet: SheetInfo | undefined = uploadData?.sheets[selectedSheetIndex];

  const handleStartScraping = async () => {
    if (!uploadData || !currentSheet) {
      setError('Please upload an Excel workbook first.');
      return;
    }

    if (!colMapping.mpn || !colMapping.mfr) {
      setError('Both MPN and Manufacturer columns must be mapped.');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const newJob = await api.createJob({
        file_token: uploadData.file_token,
        sheet_name: currentSheet.name,
        column_mapping: colMapping,
        limit: processAll ? null : Number(limit),
        timeout: Number(timeout),
        retries: Number(retries),
        use_gemini: Boolean(useGemini),
        save_every: periodicSave ? Number(saveEvery) : 0,
      });

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
          Upload your product catalog workbook (.xlsx), map columns, and execute automated multi-source enrichment.
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
            Supports .xlsx and .xlsm files up to 50MB
          </p>
          {uploading && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-blue-600 font-semibold">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>Analyzing workbook structure and columns...</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Worksheet and Preview */}
      {uploadData && currentSheet && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
            <span>Worksheet Selection & Preview</span>
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full sm:w-72">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Worksheet</label>
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
            <span>Column Mapping</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MPN Column */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                MPN / Part Number <span className="text-rose-500">*</span>
              </label>
              <select
                value={colMapping.mpn}
                onChange={(e) => setColMapping({ ...colMapping, mpn: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Column --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Primary identifier</span>
            </div>

            {/* Manufacturer Column */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Manufacturer / Brand <span className="text-rose-500">*</span>
              </label>
              <select
                value={colMapping.mfr}
                onChange={(e) => setColMapping({ ...colMapping, mfr: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Column --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Brand verification</span>
            </div>

            {/* Product Title Column */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Existing Title (Optional)
              </label>
              <select
                value={colMapping.title}
                onChange={(e) => setColMapping({ ...colMapping, title: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Fallback title</span>
            </div>

            {/* Existing URL Column */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Existing URL (Optional)
              </label>
              <select
                value={colMapping.url}
                onChange={(e) => setColMapping({ ...colMapping, url: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None --</option>
                {currentSheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Prioritized candidate</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Scraping Configuration */}
      {uploadData && currentSheet && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
            <span>Scraping Execution Settings</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Process Limit */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={processAll}
                  onChange={(e) => setProcessAll(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-800">Process until end of file</span>
              </label>

              {!processAll && (
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max products limit</label>
                  <input
                    type="number"
                    min={1}
                    max={currentSheet.row_count}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}
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
              <label className="block text-xs font-bold text-slate-800 mb-1">Max Retries</label>
              <input
                type="number"
                min={0}
                max={5}
                value={retries}
                onChange={(e) => setRetries(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">Retry per site attempt</span>
            </div>

            {/* AI Toggle */}
            <div>
              <label className="flex items-center space-x-2 cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={useGemini}
                  disabled={!geminiAvailable}
                  onChange={(e) => setUseGemini(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Google Gemini AI</span>
                </span>
              </label>
              <span className="text-[11px] text-slate-400 block">
                {geminiAvailable ? 'Fills missing specs & overview' : 'No API key configured'}
              </span>
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
                <span className="text-xs font-bold text-slate-800 block">Simultaneous Incremental Excel Saving</span>
                <span className="text-[11px] text-slate-500">Safely updates output files as products are processed</span>
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
                <span>Start Scraping (Auto-Run to End)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

