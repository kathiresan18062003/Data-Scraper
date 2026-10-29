import React from 'react';
import {
  Search,
  ExternalLink,
  Eye,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  List,
  Layers,
} from 'lucide-react';
import { ProductResult } from '../types';

interface ResultsTableProps {
  results: ProductResult[];
  total: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onSelectProduct: (product: ProductResult) => void;
  isLoading: boolean;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  total,
  currentPage,
  totalPages,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  onSelectProduct,
  isLoading,
}) => {
  const statusColors = {
    SUCCESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REVIEW: 'bg-amber-100 text-amber-800 border-amber-200',
    FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
    PENDING: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const statusOptions = ['ALL', 'SUCCESS', 'REVIEW', 'FAILED'];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search MPN, Manufacturer, or Product Name..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {statusOptions.map((st) => (
            <button
              key={st}
              onClick={() => onStatusFilterChange(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-3 py-3 w-12 text-center">Row</th>
              <th className="px-3 py-3 w-14 text-center">Image</th>
              <th className="px-3 py-3">MPN & Brand</th>
              <th className="px-3 py-3 max-w-[220px]">Extracted Product Title</th>
              <th className="px-3 py-3">Extracted Data Fields</th>
              <th className="px-3 py-3">Verified Sources</th>
              <th className="px-3 py-3">Status & Score</th>
              <th className="px-3 py-3">Notes & Reason</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                  <span>Loading product results...</span>
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400">
                  No product results found matching your criteria.
                </td>
              </tr>
            ) : (
              results.map((res) => {
                const specsCount = res.specifications?.length || 0;
                const featuresCount = res.features?.length || 0;
                const fitmentsCount = res.fitments?.length || 0;
                const sources = res.source_urls || (res.source_url ? [res.source_url] : []);

                return (
                  <tr key={res.id} className="hover:bg-slate-50/80 transition">
                    {/* Row */}
                    <td className="px-3 py-3 font-mono font-bold text-slate-600 text-center">
                      #{res.row_index}
                    </td>

                    {/* Image */}
                    <td className="px-3 py-3 text-center">
                      {res.image_url ? (
                        <img
                          src={res.image_url}
                          alt={res.mpn}
                          className="w-11 h-11 object-contain rounded border border-slate-200 bg-white p-0.5 mx-auto cursor-pointer hover:scale-110 transition-transform shadow-xs"
                          onClick={() => onSelectProduct(res)}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 mx-auto">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* MPN & Brand */}
                    <td className="px-3 py-3">
                      <span className="font-bold text-slate-900 block font-mono text-xs">{res.mpn}</span>
                      <span className="text-slate-500 text-[11px] font-medium">{res.manufacturer}</span>
                    </td>

                    {/* Extracted Product Title */}
                    <td className="px-3 py-3 max-w-[220px]">
                      <span className="font-medium text-slate-800 line-clamp-2 text-xs" title={res.product_name || res.title}>
                        {res.product_name || res.title || <span className="text-slate-400 italic">None</span>}
                      </span>
                      {res.overview && (
                        <span className="text-[10px] text-slate-400 block line-clamp-1 mt-0.5" title={res.overview}>
                          {res.overview}
                        </span>
                      )}
                      {res.extraction_method === 'gemini_enhanced' && (
                        <span className="inline-flex items-center space-x-1 mt-0.5 text-[10px] text-purple-600 font-medium">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Gemini AI</span>
                        </span>
                      )}
                    </td>

                    {/* Extracted Data Fields (Specs, Features, Fitments) */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="inline-flex items-center space-x-1 text-slate-700">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Specs: <strong className="font-semibold text-slate-900">{specsCount}</strong></span>
                        </span>
                        <span className="inline-flex items-center space-x-1 text-slate-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Features: <strong className="font-semibold text-slate-900">{featuresCount}</strong></span>
                        </span>
                        {fitmentsCount > 0 && (
                          <span className="inline-flex items-center space-x-1 text-slate-700">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span>Fitments: <strong className="font-semibold text-slate-900">{fitmentsCount}</strong></span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Verified Sources (up to 3) */}
                    <td className="px-3 py-3 max-w-[180px]">
                      {sources.length > 0 ? (
                        <div className="space-y-1">
                          {sources.slice(0, 3).map((u, i) => (
                            <a
                              key={i}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1 truncate font-mono text-[10px] block"
                              title={u}
                            >
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">Source {i + 1}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">None</span>
                      )}
                    </td>

                    {/* Status & Match Score */}
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold border text-[11px] inline-block ${statusColors[res.status] || 'bg-slate-100'}`}>
                        {res.status}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1 font-medium">
                        {res.score} pts ({res.confidence})
                      </div>
                    </td>

                    {/* Notes & Reason */}
                    <td className="px-3 py-3 max-w-[200px]">
                      {res.rework_reason ? (
                        <span className="block text-[11px] text-rose-700 font-medium line-clamp-2" title={res.rework_reason}>
                          {res.rework_reason}
                        </span>
                      ) : res.validation_notes && res.validation_notes.length > 0 ? (
                        <span className="block text-[11px] text-slate-600 line-clamp-2" title={res.validation_notes.join('; ')}>
                          {res.validation_notes[0]}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}

                      {res.google_search_url && (
                        <a
                          href={res.google_search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline inline-flex items-center space-x-1 font-semibold text-[10px] mt-1"
                        >
                          <span>Google fallback</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onSelectProduct(res)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold transition inline-flex items-center space-x-1 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
        <div>
          Showing {results.length} of {total} products
        </div>
        <div className="flex items-center space-x-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-800">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
