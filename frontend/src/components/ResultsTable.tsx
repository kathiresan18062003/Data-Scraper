import React, { useState } from 'react';
import { Search, ExternalLink, Eye, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles } from 'lucide-react';
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
              <th className="px-4 py-3 w-16">Row</th>
              <th className="px-4 py-3 w-16">Image</th>
              <th className="px-4 py-3">MPN & Manufacturer</th>
              <th className="px-4 py-3">Extracted Product Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Confidence & Tier</th>
              <th className="px-4 py-3">Source URL</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                  <span>Loading product results...</span>
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  No product results found matching your criteria.
                </td>
              </tr>
            ) : (
              results.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono font-medium text-slate-500">
                    #{res.row_index}
                  </td>
                  <td className="px-4 py-3">
                    {res.image_url ? (
                      <img
                        src={res.image_url}
                        alt={res.mpn}
                        className="w-10 h-10 object-contain rounded border border-slate-200 bg-white p-0.5"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900 block font-mono">{res.mpn}</span>
                    <span className="text-slate-500 text-[11px]">{res.manufacturer}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="font-medium text-slate-800 line-clamp-2" title={res.product_name || res.title}>
                      {res.product_name || res.title || <span className="text-slate-400 italic">None</span>}
                    </span>
                    {res.extraction_method === 'gemini_enhanced' && (
                      <span className="inline-flex items-center space-x-1 mt-0.5 text-[10px] text-purple-600 font-medium">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Gemini AI</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold border text-[11px] ${statusColors[res.status] || 'bg-slate-100'}`}>
                      {res.status}
                    </span>
                    {res.rework_reason && (
                      <span className="block text-[10px] text-rose-600 font-medium mt-0.5 truncate max-w-[150px]" title={res.rework_reason}>
                        {res.rework_reason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800 block text-[11px]">
                      {res.confidence} ({res.score} pts)
                    </span>
                    <span className="text-slate-500 text-[10px] block truncate max-w-[130px]">
                      {res.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {res.source_url ? (
                      <a
                        href={res.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center space-x-1 truncate font-mono text-[11px]"
                        title={res.source_url}
                      >
                        <span className="truncate">{res.source_url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : res.google_search_url ? (
                      <a
                        href={res.google_search_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline flex items-center space-x-1 font-semibold text-[11px]"
                      >
                        <span>Google Search</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelectProduct(res)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition inline-flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
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

