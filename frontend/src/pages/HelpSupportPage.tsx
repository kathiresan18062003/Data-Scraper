import React from 'react';
import {
  HelpCircle,
  FileSpreadsheet,
  Layers,
  FileCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Download,
  Search,
  Globe,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

export const HelpSupportPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Help & Documentation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete guide to preparing workbooks, understanding the 5 scraping stages, and exporting enriched datasets.
        </p>
      </div>

      {/* Section 1: Preparing Your Excel Catalog */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-slate-900">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold">1. Preparing Your Excel Workbook</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The scraper accepts standard Excel files (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">.xlsx</code>,{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">.xlsm</code>). Before uploading, ensure your file contains at least one column identifying the product part number.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200/80 space-y-2">
            <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Required Columns</span>
            </span>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-slate-900">MPN / Part Number:</strong> The manufacturer part number (e.g., <code className="bg-white px-1 rounded border">140-10206</code>, <code className="bg-white px-1 rounded border">K80027</code>).
              </li>
              <li>
                <strong className="text-slate-900">Manufacturer / Brand:</strong> The brand or maker name (e.g., <code className="bg-white px-1 rounded border">Wilwood</code>, <code className="bg-white px-1 rounded border">Moog</code>). If blank, defaults to &ldquo;Unknown&rdquo; and queries by MPN.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Optional Helpful Columns</span>
            </span>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-slate-900">Existing URL:</strong> If you already know the product page, provide it. The engine will prioritize it directly before searching!
              </li>
              <li>
                <strong className="text-slate-900">Existing Title / Description:</strong> Used as fallback metadata if a product page is behind a heavy paywall.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 2: The 5-Stage Scraping Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-slate-900">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold">2. The 5-Stage Automated Enrichment Pipeline</h2>
        </div>
        <p className="text-xs text-slate-600">
          Every product row progresses through five transparent processing steps:
        </p>

        <div className="space-y-3 pt-2">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">Stage 1: Discover Sources</span>
              <p className="text-slate-600 mt-0.5">
                Checks provided direct URLs first. Otherwise, queries search engines using <code className="bg-slate-200 px-1 rounded font-mono">&ldquo;{'{mfr}'} {'{mpn}'}&rdquo;</code> to discover genuine product pages, filtering out low-quality aggregator domains.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">Stage 2: Fetch Page</span>
              <p className="text-slate-600 mt-0.5">
                Performs an HTTP request with modern desktop browser User-Agents and anti-bot headers. Enforces a polite 1.5-second delay per unique domain to prevent IP blocks.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">Stage 3: Extract Data</span>
              <p className="text-slate-600 mt-0.5">
                Executes high-precision deterministic parsing: extracts Schema.org JSON-LD, 2-column specification tables, <code className="bg-slate-200 px-1 rounded font-mono">&lt;dl&gt;&lt;dt&gt;&lt;dd&gt;</code> lists, bulleted features, vehicle fitments, and high-resolution product imagery. Optional Google Gemini AI synthesizes missing overviews.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              4
            </div>
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">Stage 4: Validate Product</span>
              <p className="text-slate-600 mt-0.5">
                Scores identity confidence against the target MPN. Products with exact MPN presence score &ge; 35 points and receive <span className="font-bold text-emerald-600">SUCCESS</span> status. Products with partial matches retain all extracted data and receive <span className="font-bold text-amber-600">REVIEW</span> status.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              5
            </div>
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">Stage 5: Save to Excel</span>
              <p className="text-slate-600 mt-0.5">
                Writes the record to SQLite and updates the output workbook files incrementally after every batch. Even if interrupted, all finished products remain saved safely on disk.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: The 3 Export Formats */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-slate-900">
          <Download className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold">3. The Three Distinct Excel Export Formats</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
              Recommended
            </span>
            <h3 className="font-bold text-sm text-slate-900">Final Organized Output</h3>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              A pristine e-commerce catalog ready for Shopify, BigCommerce, or ERP imports. Exactly one row per product with formatted specifications, bulleted features, primary image URL, and verified source links.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
              In-Place
            </span>
            <h3 className="font-bold text-sm text-slate-900">Enriched Source Workbook</h3>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Your original uploaded worksheet preserved exactly as provided, with new columns appended on the right: <code className="bg-slate-200 px-1 rounded">Scraped_Title</code>, <code className="bg-slate-200 px-1 rounded">Scraped_Image</code>, <code className="bg-slate-200 px-1 rounded">Scraped_Specs</code>, and <code className="bg-slate-200 px-1 rounded">Match_Score</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
              Audit
            </span>
            <h3 className="font-bold text-sm text-slate-900">Scrape Review & Audit Report</h3>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Designed for quality assurance. Includes an Executive Summary tab plus a detailed audit list of all items marked for review or failure, with exact rework reasons and pre-generated Google fallback search links.
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Frequently Asked Questions & Troubleshooting */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-slate-900">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold">4. Frequently Asked Questions & Troubleshooting</h2>
        </div>

        <div className="space-y-4 text-xs divide-y divide-slate-100">
          <div className="pt-3 first:pt-0">
            <h4 className="font-bold text-slate-900">Why are some items classified as &ldquo;REVIEW&rdquo; instead of &ldquo;SUCCESS&rdquo;?</h4>
            <p className="text-slate-600 mt-1">
              If a product page was found and specifications or images were extracted, but the HTML did not contain an exact case-insensitive match for the target MPN (e.g. variations with hyphens like &ldquo;140-10206-R&rdquo; vs &ldquo;14010206&rdquo;), the engine preserves all extracted data under REVIEW status so you can verify it in the Results table without losing any information.
            </p>
          </div>

          <div className="pt-3">
            <h4 className="font-bold text-slate-900">Do I need a Google Gemini API key to use the scraper?</h4>
            <p className="text-slate-600 mt-1">
              No. The scraper features a deterministic HTML/DOM extraction engine that extracts Schema.org JSON-LD, tables, and definition lists directly from product websites. Google Gemini AI is an optional synthesis layer that enriches overviews and missing specs. If no key is set or if quota is exhausted, the engine falls back to pure DOM extraction seamlessly.
            </p>
          </div>

          <div className="pt-3">
            <h4 className="font-bold text-slate-900">Can I pause or stop an ongoing scraping job?</h4>
            <p className="text-slate-600 mt-1">
              Yes. You can click <strong>Pause</strong> at any time to temporarily suspend the scraper. You can click <strong>Cancel</strong> to safely conclude the job. All products scraped up to that point remain saved in your Excel output files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

