import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Job, ProductResult } from '../types';
import { ResultsTable } from '../components/ResultsTable';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { DownloadButtons } from '../components/DownloadButtons';
import { MetricsCards } from '../components/MetricsCards';

interface ResultsPageProps {
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ selectedJobId, onSelectJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const [results, setResults] = useState<ProductResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [inspectProduct, setInspectProduct] = useState<ProductResult | null>(null);

  // Load jobs list
  useEffect(() => {
    api.listJobs().then((data) => {
      setJobs(data);
      if (!selectedJobId && data.length > 0) {
        onSelectJob(data[0].id);
      }
    });
  }, []);

  // Update active job metadata
  useEffect(() => {
    if (selectedJobId) {
      api.getJob(selectedJobId).then(setActiveJob).catch(() => {});
    }
  }, [selectedJobId]);

  // Load results whenever job, page, filter, or search changes
  useEffect(() => {
    if (!selectedJobId) return;

    setLoading(true);
    api.getJobResults(selectedJobId, page, 25, statusFilter, searchTerm)
      .then((data) => {
        setResults(data.items);
        setTotal(data.total);
        setTotalPages(data.total_pages);
      })
      .catch((err) => console.error('Failed to fetch results', err))
      .finally(() => setLoading(false));
  }, [selectedJobId, page, statusFilter, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Job Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scraping Results Explorer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search, filter, and inspect detailed extraction evidence, specifications, and source links.
          </p>
        </div>

        {jobs.length > 0 && (
          <div className="w-full sm:w-72">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Scraping Job</label>
            <select
              value={selectedJobId || ''}
              onChange={(e) => {
                onSelectJob(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.original_filename} ({j.status}) - {j.processed_products}/{j.total_products} items
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Metrics for active job */}
      {activeJob && (
        <MetricsCards
          total={activeJob.total_products}
          processed={activeJob.processed_products}
          success={activeJob.successful_products}
          review={activeJob.review_products}
          failed={activeJob.failed_products}
        />
      )}

      {/* Field Completion Rates */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">
            Dataset Field-Completion Rates (Loaded Sample)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Product Images</span>
              <span className="font-bold text-slate-800 text-sm">
                {Math.round((results.filter((r) => Boolean(r.image_url)).length / results.length) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {results.filter((r) => Boolean(r.image_url)).length}/{results.length} items
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Overview Description</span>
              <span className="font-bold text-slate-800 text-sm">
                {Math.round((results.filter((r) => Boolean(r.overview)).length / results.length) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {results.filter((r) => Boolean(r.overview)).length}/{results.length} items
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Specifications Table</span>
              <span className="font-bold text-slate-800 text-sm">
                {Math.round((results.filter((r) => r.specifications && r.specifications.length > 0).length / results.length) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {results.filter((r) => r.specifications && r.specifications.length > 0).length}/{results.length} items
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Features Bullets</span>
              <span className="font-bold text-slate-800 text-sm">
                {Math.round((results.filter((r) => r.features && r.features.length > 0).length / results.length) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {results.filter((r) => r.features && r.features.length > 0).length}/{results.length} items
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Fitments / Vehicle</span>
              <span className="font-bold text-slate-800 text-sm">
                {Math.round((results.filter((r) => r.fitments && r.fitments.length > 0).length / results.length) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {results.filter((r) => r.fitments && r.fitments.length > 0).length}/{results.length} items
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Download Reports Bar */}
      {selectedJobId && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Download Completed Reports (.xlsx)
          </h3>
          <DownloadButtons jobId={selectedJobId} hasOutput={activeJob?.has_output} />
        </div>
      )}

      {/* Main Results Table */}
      <ResultsTable
        results={results}
        total={total}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        statusFilter={statusFilter}
        onStatusFilterChange={(st) => {
          setStatusFilter(st);
          setPage(1);
        }}
        searchTerm={searchTerm}
        onSearchChange={(s) => {
          setSearchTerm(s);
          setPage(1);
        }}
        onSelectProduct={setInspectProduct}
        isLoading={loading}
      />

      {/* Detail Modal */}
      <ProductDetailModal
        product={inspectProduct}
        onClose={() => setInspectProduct(null)}
      />
    </div>
  );
};

