import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    UploadSimple,
    FileJs,
    Play,
    MagnifyingGlass,
    CaretDown,
    CaretUp,
    CircleNotch,
    Trash,
} from '@phosphor-icons/react';
import type { Dataset } from '../data/mockData';
import { listDatasets, uploadDatasetFile, getDatasetItems, deleteDataset } from '../services/api';
import EvaluationConfigModal from '../components/EvaluationConfigModal';

interface DatasetItem {
    query: string;
    context: string;
    response: string;
    ground_truth?: string;
}

export default function Datasets() {
    const { t } = useTranslation();
    const [isDragOver, setIsDragOver] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [items, setItems] = useState<DatasetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadDatasets();
    }, []);

    // When a dataset is selected, load its items
    useEffect(() => {
        if (selectedDataset) {
            loadItems(selectedDataset);
        } else {
            setItems([]);
        }
    }, [selectedDataset]);

    async function loadDatasets() {
        try {
            const d = await listDatasets();
            setDatasets(d);
            if (d.length > 0 && !selectedDataset) {
                setSelectedDataset(d[0].id);
            }
        } catch (err) {
            console.error('Failed to load datasets:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadItems(dsId: string) {
        try {
            const result = await getDatasetItems(dsId, 0, 200);
            setItems(result.items as unknown as DatasetItem[]);
        } catch (err) {
            console.error('Failed to load items:', err);
        }
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.jsonl') || file.name.endsWith('.json'))) {
            await handleUpload(file);
        }
    }, []);

    const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await handleUpload(file);
        }
    }, []);

    async function handleUpload(file: File) {
        setUploading(true);
        try {
            const ds = await uploadDatasetFile(file);
            setDatasets((prev) => [ds, ...prev]);
            setSelectedDataset(ds.id);
        } catch (err) {
            console.error('Upload failed:', err);
            alert(`Upload failed: ${err}`);
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete(dsId: string) {
        try {
            await deleteDataset(dsId);
            setDatasets((prev) => prev.filter((d) => d.id !== dsId));
            if (selectedDataset === dsId) {
                setSelectedDataset(null);
                setItems([]);
            }
        } catch (err) {
            console.error('Delete failed:', err);
        }
    }

    const filteredItems = items.filter(
        (item) =>
            item.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.context.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tableHeaders = [
        '#',
        t('datasets.table.query'),
        t('datasets.table.context'),
        t('datasets.table.response'),
        t('datasets.table.ground_truth'),
        '',
    ];

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
                <CircleNotch weight="bold" className="text-3xl text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">{t('datasets.title')}</h2>
                    <p className="text-sm text-zinc-500 mt-1">{t('datasets.subtitle')}</p>
                </div>
            </div>

            {/* Upload zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
                className={`relative rounded-xl border-2 border-dashed transition-all duration-200 p-8 text-center cursor-pointer ${isDragOver
                    ? 'border-indigo-500/50 bg-indigo-500/5 scale-[1.01]'
                    : 'border-white/10 bg-zinc-900/30 hover:border-white/20 hover:bg-zinc-900/50'
                    }`}
            >
                <input
                    id="file-upload"
                    type="file"
                    accept=".jsonl,.json"
                    onChange={handleFileInput}
                    className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                    <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] transition-colors ${isDragOver ? 'text-indigo-400' : 'text-zinc-400'
                            }`}
                    >
                        {uploading ? (
                            <CircleNotch weight="bold" className="text-2xl animate-spin text-indigo-400" />
                        ) : (
                            <UploadSimple weight="duotone" className="text-2xl" />
                        )}
                    </div>
                    <div>
                        <p className="text-[14px] font-medium text-zinc-300">
                            {uploading ? t('datasets.uploading') : (
                                <>
                                    {t('datasets.drag_hint')}{' '}
                                    <code className="font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[13px] border border-indigo-500/20">
                                        .jsonl
                                    </code>{' '}
                                    {t('datasets.drag_or')}{' '}
                                    <code className="font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[13px] border border-indigo-500/20">
                                        .json
                                    </code>{' '}
                                    {t('datasets.drag_here')}
                                </>
                            )}
                        </p>
                        <p className="text-[12px] text-zinc-600 mt-1">{t('datasets.drag_sub')}</p>
                    </div>
                </div>
            </div>

            {/* Dataset pills */}
            <div className="flex items-center gap-2 flex-wrap">
                {datasets.map((ds) => (
                    <div key={ds.id} className="relative group">
                        <button
                            onClick={() => setSelectedDataset(ds.id === selectedDataset ? null : ds.id)}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-[13px] font-medium transition-all ${selectedDataset === ds.id
                                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                                : 'border-white/5 bg-zinc-900/30 text-zinc-400 hover:border-white/10 hover:text-zinc-300'
                                }`}
                        >
                            <FileJs weight="duotone" className="text-base" />
                            <span className="font-mono">{ds.name}</span>
                            <span className="text-[11px] text-zinc-600 ml-1">{ds.itemCount} {t('common.items')}</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ds.id); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-white/10 text-zinc-600 hover:text-red-400 hover:border-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash weight="bold" className="text-[10px]" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between">
                <div className="relative">
                    <MagnifyingGlass weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-zinc-600" />
                    <input
                        type="text"
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 w-64 text-[13px] border border-white/10 rounded-lg bg-zinc-900/50 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all"
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!selectedDataset}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-[13px] font-medium hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
                >
                    <Play weight="duotone" className="text-base" />
                    {t('datasets.start_eval')}
                </button>
            </div>

            {/* Data table */}
            <div className="bg-zinc-900/30 rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                {tableHeaders.map((h, i) => (
                                    <th
                                        key={i}
                                        className="text-left px-4 py-3 text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-600">
                                        {selectedDataset ? t('datasets.no_items') : t('datasets.select_dataset')}
                                    </td>
                                </tr>
                            )}
                            {filteredItems.map((item, idx) => {
                                const itemId = `item-${idx + 1}`;
                                return (
                                    <>
                                        <tr
                                            key={itemId}
                                            className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${idx < filteredItems.length - 1 || expandedRow === itemId ? 'border-b border-white/5' : ''
                                                }`}
                                            onClick={() => setExpandedRow(expandedRow === itemId ? null : itemId)}
                                        >
                                            <td className="px-4 py-3 text-[12.5px] font-mono text-indigo-400 font-medium whitespace-nowrap">
                                                {idx + 1}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] text-zinc-300 max-w-[200px] truncate">
                                                {item.query}
                                            </td>
                                            <td className="px-4 py-3 text-[12.5px] text-zinc-500 max-w-[180px] truncate font-mono">
                                                {item.context.slice(0, 50)}...
                                            </td>
                                            <td className="px-4 py-3 text-[12.5px] text-zinc-500 max-w-[180px] truncate font-mono">
                                                {item.response.slice(0, 50)}...
                                            </td>
                                            <td className="px-4 py-3 text-[12.5px] text-zinc-500 max-w-[150px] truncate">
                                                {item.ground_truth || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {expandedRow === itemId ? (
                                                    <CaretUp weight="bold" className="text-sm text-zinc-600" />
                                                ) : (
                                                    <CaretDown weight="bold" className="text-sm text-zinc-600" />
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRow === itemId && (
                                            <tr key={`${itemId}-detail`}>
                                                <td colSpan={6} className="px-4 py-4 border-b border-white/5">
                                                    <div className="grid grid-cols-2 gap-4 text-[12.5px]">
                                                        <div>
                                                            <p className="font-semibold text-zinc-400 mb-1.5">{t('datasets.table.context')}</p>
                                                            <p className="text-zinc-400 font-mono bg-zinc-900/50 p-3 rounded-lg border border-white/5 leading-relaxed">
                                                                {item.context}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-zinc-400 mb-1.5">{t('datasets.table.response')}</p>
                                                            <p className="text-zinc-400 font-mono bg-zinc-900/50 p-3 rounded-lg border border-white/5 leading-relaxed">
                                                                {item.response}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && selectedDataset && <EvaluationConfigModal datasetId={selectedDataset} onClose={() => setShowModal(false)} />}
        </div>
    );
}
