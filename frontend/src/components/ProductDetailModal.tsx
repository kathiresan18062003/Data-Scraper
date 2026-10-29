import React from 'react';
import { X, ExternalLink, Image as ImageIcon, ShieldCheck, Check, AlertCircle, Sparkles } from 'lucide-react';
import { ProductResult } from '../types';

interface ProductDetailModalProps {
  product: ProductResult | null;
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  if (!product) return null;

  const statusColors = {
    SUCCESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REVIEW: 'bg-amber-100 text-amber-800 border-amber-200',
    FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
    PENDING: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const confidenceColors = {
    HIGH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    LOW: 'bg-amber-50 text-amber-700 border-amber-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors[product.status]}`}>
                {product.status}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${confidenceColors[product.confidence]}`}>
                {product.confidence} CONFIDENCE ({product.score} pts)
              </span>
              {product.extraction_method === 'gemini_enhanced' && (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>Gemini AI Enhanced</span>
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {product.manufacturer} {product.mpn}
            </h2>
            <p className="text-xs text-slate-500">{product.product_name || product.title || 'No product title found'}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Top section: image + meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Image Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[220px]">
              {product.image_url ? (
                <div className="w-full flex flex-col items-center">
                  <img
                    src={product.image_url}
                    alt={product.mpn}
                    className="max-h-48 object-contain rounded-lg shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <a
                    href={product.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-xs text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    <span>Open full image</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <span className="text-xs">No image available</span>
                </div>
              )}
            </div>

            {/* Verification & Source Summary */}
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-medium">Source Tier</span>
                  <span className="font-bold text-slate-800 text-sm">{product.tier || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-medium">Row in Workbook</span>
                  <span className="font-bold text-slate-800 text-sm">Row {product.row_index}</span>
                </div>
              </div>

              {/* Source URLs */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-1.5">Discovered Source Links</span>
                {product.source_urls && product.source_urls.length > 0 ? (
                  <ul className="space-y-1">
                    {product.source_urls.map((url, i) => (
                      <li key={i} className="text-xs truncate">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center space-x-1 font-mono"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{url}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-slate-400 italic">No validated direct sources found.</span>
                )}
              </div>

              {/* Fallback Google Search Link */}
              {product.google_search_url && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 font-medium">Search Fallback:</span>
                  <a
                    href={product.google_search_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline flex items-center space-x-1 font-semibold"
                  >
                    <span>Search Google for "{product.manufacturer} {product.mpn}"</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Rework reason / Validation notes */}
              {product.rework_reason && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <span className="font-bold">Review Note:</span> {product.rework_reason}
                </div>
              )}
            </div>
          </div>

          {/* Overview */}
          {product.overview && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Product Overview</h3>
              <p className="text-xs leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {product.overview}
              </p>
            </div>
          )}

          {/* Features */}
          {product.features && product.features.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Features & Highlights</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {product.features.map((feat, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start space-x-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Specifications Table */}
          {product.specifications && product.specifications.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Specifications</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="px-4 py-2.5 text-left w-1/3">Specification</th>
                      <th className="px-4 py-2.5 text-left">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {product.specifications.map((spec, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800 bg-slate-50/50">{spec.name}</td>
                        <td className="px-4 py-2 text-slate-600">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fitments */}
          {product.fitments && product.fitments.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Fitment & Applications</h3>
              <div className="flex flex-wrap gap-1.5">
                {product.fitments.map((fit, i) => (
                  <span key={i} className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs border border-slate-200">
                    {fit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Validation Audit Notes */}
          {product.validation_notes && product.validation_notes.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Validation Evidence</h3>
              <div className="flex flex-wrap gap-1.5">
                {product.validation_notes.map((note, i) => (
                  <span key={i} className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs border border-blue-200 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>{note}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

