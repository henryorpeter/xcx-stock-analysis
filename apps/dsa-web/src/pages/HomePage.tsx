import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  RadioTower,
  Settings2,
  Sparkles,
  Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { analysisApi } from '../api/analysis';
import { systemConfigApi } from '../api/systemConfig';
import { ApiErrorAlert, BrandMark, ConfirmDialog, Button, EmptyState, InlineAlert } from '../components/common';
import { DashboardStateBlock } from '../components/dashboard';
import { StockAutocomplete } from '../components/StockAutocomplete';
import { HistoryList } from '../components/history';
import { ReportMarkdown, ReportSummary } from '../components/report';
import { TaskPanel } from '../components/tasks';
import { useDashboardLifecycle, useHomeDashboardState } from '../hooks';
import type { SetupStatusResponse } from '../types/systemConfig';
import { getReportText, normalizeReportLanguage } from '../utils/reportLanguage';

type MarketReviewNotice = {
  variant: 'success' | 'warning' | 'danger';
  title: string;
  message: string;
} | null;

const SETUP_CATEGORY_BY_KEY: Record<string, 'ai_model' | 'agent' | 'base' | 'notification' | 'system'> = {
  llm_primary: 'ai_model',
  llm_agent: 'agent',
  stock_list: 'base',
  notification: 'notification',
  storage: 'system',
};

function getSetupTone(status: SetupStatusResponse['checks'][number]['status']) {
  if (status === 'configured') return 'success';
  if (status === 'inherited' || status === 'optional') return 'info';
  return 'warning';
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmittingMarketReview, setIsSubmittingMarketReview] = useState(false);
  const [marketReviewNotice, setMarketReviewNotice] = useState<MarketReviewNotice>(null);
  const [marketReviewError, setMarketReviewError] = useState<ParsedApiError | null>(null);
  const [marketReviewReport, setMarketReviewReport] = useState<string | null>(null);
  const [marketReviewReportCopied, setMarketReviewReportCopied] = useState(false);
  const marketReviewPollTimer = useRef<number | null>(null);
  const dashboardScrollRef = useRef<HTMLElement | null>(null);

  const stopMarketReviewPolling = useCallback(() => {
    if (marketReviewPollTimer.current !== null) {
      window.clearInterval(marketReviewPollTimer.current);
      marketReviewPollTimer.current = null;
    }
  }, []);

  const scrollMarketReviewFeedbackIntoView = useCallback(() => {
    const scrollContainer = dashboardScrollRef.current;
    if (!scrollContainer) {
      return;
    }

    if (typeof scrollContainer.scrollTo === 'function') {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    scrollContainer.scrollTop = 0;
  }, []);

  useEffect(() => stopMarketReviewPolling, [stopMarketReviewPolling]);
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);

  const {
    query,
    inputError,
    duplicateError,
    error,
    isAnalyzing,
    historyItems,
    selectedHistoryIds,
    isDeletingHistory,
    isLoadingHistory,
    isLoadingMore,
    hasMore,
    selectedReport,
    isLoadingReport,
    activeTasks,
    markdownDrawerOpen,
    setQuery,
    clearError,
    loadInitialHistory,
    refreshHistory,
    loadMoreHistory,
    selectHistoryItem,
    toggleHistorySelection,
    toggleSelectAllVisible,
    deleteSelectedHistory,
    submitAnalysis,
    notify,
    setNotify,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
    openMarkdownDrawer,
    closeMarkdownDrawer,
    selectedIds,
  } = useHomeDashboardState();

  useEffect(() => {
    document.title = '每日选股分析 - DSA';
  }, []);

  useEffect(() => {
    let active = true;
    systemConfigApi.getSetupStatus()
      .then((status) => {
        if (active) {
          setSetupStatus(status);
        }
      })
      .catch(() => {
        if (active) {
          setSetupStatus(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const reportLanguage = normalizeReportLanguage(selectedReport?.meta.reportLanguage);
  const reportText = getReportText(reportLanguage);
  const setupNeedsAction = setupStatus ? !setupStatus.isComplete : false;
  const setupChecks = setupStatus?.checks || [];
  const setupCompletedCount = setupChecks.filter((check) => check.status === 'configured' || check.status === 'inherited').length;
  const setupRequiredCount = setupChecks.filter((check) => check.required).length;
  const setupFocusChecks = useMemo(() => (
    setupChecks.filter((check) => check.required).slice(0, 3)
  ), [setupChecks]);
  const setupMissingLabels = useMemo(() => {
    if (!setupStatus) {
      return '';
    }
    const requiredNeedsAction = setupStatus.checks
      .filter((check) => check.required && check.status === 'needs_action')
      .map((check) => check.title);
    return requiredNeedsAction.slice(0, 3).join('、');
  }, [setupStatus]);

  useDashboardLifecycle({
    loadInitialHistory,
    refreshHistory,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
  });

  const handleHistoryItemClick = useCallback((recordId: number) => {
    void selectHistoryItem(recordId);
    setSidebarOpen(false);
  }, [selectHistoryItem]);

  const handleSubmitAnalysis = useCallback(
    (
      stockCode?: string,
      stockName?: string,
      selectionSource?: 'manual' | 'autocomplete' | 'import' | 'image',
    ) => {
      void submitAnalysis({
        stockCode,
        stockName,
        originalQuery: query,
        selectionSource: selectionSource ?? 'manual',
      });
    },
    [query, submitAnalysis],
  );

  const handleAskFollowUp = useCallback(() => {
    if (selectedReport?.meta.id === undefined) {
      return;
    }

    const code = selectedReport.meta.stockCode;
    const name = selectedReport.meta.stockName;
    const rid = selectedReport.meta.id;
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}&recordId=${rid}`);
  }, [navigate, selectedReport]);

  const handleReanalyze = useCallback(() => {
    if (!selectedReport) {
      return;
    }

    void submitAnalysis({
      stockCode: selectedReport.meta.stockCode,
      stockName: selectedReport.meta.stockName,
      originalQuery: selectedReport.meta.stockCode,
      selectionSource: 'manual',
      forceRefresh: true,
    });
  }, [selectedReport, submitAnalysis]);

  const pollMarketReviewStatus = useCallback(
    async (taskId: string) => {
      stopMarketReviewPolling();

      const maxAttempts = 120;
      const intervalMs = 2000;
      let attempts = 0;

      const poll = async (): Promise<boolean> => {
        if (attempts >= maxAttempts) {
          stopMarketReviewPolling();
          setMarketReviewReport(null);
          setMarketReviewNotice({
            variant: 'danger',
            title: '大盘复盘已超时',
            message: '任务长时间未返回最终结果，请在任务列表/历史中查看。',
          });
          scrollMarketReviewFeedbackIntoView();
          return false;
        }

        attempts += 1;

        try {
          const status = await analysisApi.getStatus(taskId);
          if (status.status === 'pending' || status.status === 'processing') {
            setMarketReviewReport(null);
            const progress = typeof status.progress === 'number'
              ? `${status.progress}%`
              : '进行中';
            setMarketReviewNotice({
              variant: 'warning',
              title: '大盘复盘进行中',
              message: `任务状态：${status.status}（${progress}）`,
            });
            return true;
          }

          if (status.status === 'completed') {
            stopMarketReviewPolling();
            const marketReviewText = typeof status.marketReviewReport === 'string'
              ? status.marketReviewReport
              : '';
            setMarketReviewReport(marketReviewText ? marketReviewText.trim() : null);
            setMarketReviewNotice({
              variant: 'success',
              title: '大盘复盘已完成',
              message: marketReviewText ? '大盘复盘任务已完成，结果如下：' : '大盘复盘任务已完成，结果已生成并按配置推送。',
            });
            setMarketReviewError(null);
            scrollMarketReviewFeedbackIntoView();
            return false;
          }

          if (status.status === 'failed') {
            stopMarketReviewPolling();
            setMarketReviewReport(null);
            setMarketReviewError(
              getParsedApiError({
                response: {
                  status: 500,
                  data: {
                    error: 'market_review_failed',
                    message: status.error || '大盘复盘执行失败。',
                  },
                },
              }),
            );
            setMarketReviewNotice(null);
            scrollMarketReviewFeedbackIntoView();
            return false;
          }

          stopMarketReviewPolling();
          setMarketReviewReport(null);
          setMarketReviewNotice({
            variant: 'danger',
            title: '大盘复盘状态异常',
            message: `收到未知任务状态：${status.status}`,
          });
          scrollMarketReviewFeedbackIntoView();
          return false;
        } catch (err: unknown) {
          const parsed = getParsedApiError(err);
          if (attempts >= maxAttempts) {
            stopMarketReviewPolling();
            setMarketReviewReport(null);
            setMarketReviewError(parsed);
            setMarketReviewNotice(null);
            scrollMarketReviewFeedbackIntoView();
            return false;
          }
          return true;
        }

        return true;
      };

      if (await poll()) {
        marketReviewPollTimer.current = window.setInterval(() => {
          void poll().then((shouldContinue) => {
            if (!shouldContinue) {
              stopMarketReviewPolling();
            }
          });
        }, intervalMs);
      }
    },
    [scrollMarketReviewFeedbackIntoView, stopMarketReviewPolling],
  );

  const handleTriggerMarketReview = useCallback(async () => {
    setIsSubmittingMarketReview(true);
    setMarketReviewNotice(null);
    setMarketReviewError(null);
    setMarketReviewReport(null);
    scrollMarketReviewFeedbackIntoView();
    try {
      const result = await analysisApi.triggerMarketReview({ sendNotification: notify });
      setMarketReviewNotice({
        variant: 'success',
        title: '大盘复盘已提交',
        message: result.message,
      });
      scrollMarketReviewFeedbackIntoView();

      if (result.taskId) {
        await pollMarketReviewStatus(result.taskId);
      }
    } catch (err: unknown) {
      setMarketReviewError(getParsedApiError(err));
      setMarketReviewNotice(null);
      scrollMarketReviewFeedbackIntoView();
    } finally {
      setIsSubmittingMarketReview(false);
    }
  }, [notify, pollMarketReviewStatus, scrollMarketReviewFeedbackIntoView]);

  const handleCopyMarketReviewReport = useCallback(() => {
    if (!marketReviewReport) {
      return;
    }

    void navigator.clipboard.writeText(marketReviewReport).then(
      () => {
        setMarketReviewReportCopied(true);
        setTimeout(() => setMarketReviewReportCopied(false), 2000);
      },
      (err) => {
        console.error('复制失败:', err);
      },
    );
  }, [marketReviewReport]);

  const handleDeleteSelectedHistory = useCallback(() => {
    void deleteSelectedHistory();
    setShowDeleteConfirm(false);
  }, [deleteSelectedHistory]);

  const sidebarContent = useMemo(
    () => (
      <div className="flex min-h-0 h-full flex-col gap-3 overflow-hidden">
        <TaskPanel tasks={activeTasks} />
        <HistoryList
          items={historyItems}
          isLoading={isLoadingHistory}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          selectedId={selectedReport?.meta.id}
          selectedIds={selectedIds}
          isDeleting={isDeletingHistory}
          onItemClick={handleHistoryItemClick}
          onLoadMore={() => void loadMoreHistory()}
          onToggleItemSelection={toggleHistorySelection}
          onToggleSelectAll={toggleSelectAllVisible}
          onDeleteSelected={() => setShowDeleteConfirm(true)}
          className="flex-1 overflow-hidden"
        />
      </div>
    ),
    [
      activeTasks,
      hasMore,
      historyItems,
      isDeletingHistory,
      isLoadingHistory,
      isLoadingMore,
      handleHistoryItemClick,
      loadMoreHistory,
      selectedIds,
      selectedReport?.meta.id,
      toggleHistorySelection,
      toggleSelectAllVisible,
    ],
  );

  return (
    <div
      data-testid="home-dashboard"
      className="flex h-[calc(100vh-5rem)] w-full flex-col overflow-hidden md:flex-row sm:h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-2rem)]"
    >
      <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-full lg:max-w-6xl mx-auto w-full">
        <header className="flex min-w-0 flex-shrink-0 items-center overflow-hidden px-3 py-3 md:px-4 md:py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden -ml-1 flex-shrink-0 rounded-lg p-1.5 text-secondary-text transition-colors hover:bg-hover hover:text-foreground"
                aria-label="历史记录"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="relative min-w-0 flex-1">
                <StockAutocomplete
                  value={query}
                  onChange={setQuery}
                  onSubmit={(stockCode, stockName, selectionSource) => {
                    handleSubmitAnalysis(stockCode, stockName, selectionSource);
                  }}
                  placeholder="输入股票代码或名称，如 600519、贵州茅台、AAPL"
                  disabled={isAnalyzing}
                  className={inputError ? 'border-danger/50' : undefined}
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-shrink-0 items-center gap-2.5">
              <label className="flex h-10 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-subtle bg-surface/60 px-3 text-xs text-secondary-text select-none transition-colors hover:border-subtle-hover hover:text-foreground">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                推送通知
              </label>
              <Button
                type="button"
                variant="secondary"
                size="md"
                isLoading={isSubmittingMarketReview}
                loadingText="提交中"
                onClick={() => void handleTriggerMarketReview()}
                className="h-10 flex-1 whitespace-nowrap md:flex-none"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                大盘复盘
              </Button>
              <button
                type="button"
                onClick={() => handleSubmitAnalysis()}
                disabled={!query || isAnalyzing}
                className="btn-primary flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap md:flex-none"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    分析中
                  </>
                ) : (
                  '分析'
                )}
              </button>
            </div>
          </div>
        </header>

        {inputError || duplicateError ? (
          <div className="px-3 pb-2 md:px-4">
            {inputError ? (
              <InlineAlert
                variant="danger"
                title="输入有误"
                message={inputError}
                className="rounded-xl px-3 py-2 text-xs shadow-none"
              />
            ) : null}
            {!inputError && duplicateError ? (
              <InlineAlert
                variant="warning"
                title="任务已存在"
                message={duplicateError}
                className="rounded-xl px-3 py-2 text-xs shadow-none"
              />
            ) : null}
          </div>
        ) : null}

        {setupNeedsAction ? (
          <div className="px-3 pb-2 md:px-4">
            <InlineAlert
              variant="warning"
              title="基础配置未完成"
              message={
                setupMissingLabels
                  ? `还缺少 ${setupMissingLabels}，完成后即可开始最小可用分析。`
                  : '还缺少基础配置，完成后即可开始最小可用分析。'
              }
              action={(
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  去配置
                </Button>
              )}
              className="rounded-xl px-3 py-2 text-xs shadow-none"
            />
          </div>
        ) : null}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="hidden min-h-0 w-64 shrink-0 flex-col overflow-hidden pl-4 pb-4 md:flex lg:w-72">
            {sidebarContent}
          </div>

          {sidebarOpen ? (
            <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
              <div className="page-drawer-overlay absolute inset-0" />
              <div
                className="dashboard-card absolute bottom-0 left-0 top-0 flex w-72 flex-col overflow-hidden !rounded-none !rounded-r-xl p-3 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                {sidebarContent}
              </div>
            </div>
          ) : null}

          <section
            ref={dashboardScrollRef}
            data-testid="home-dashboard-scroll"
            className="flex-1 min-w-0 min-h-0 overflow-x-auto overflow-y-auto px-3 pb-4 md:px-6 touch-pan-y"
          >
            <div className="mb-4 overflow-hidden rounded-[1.75rem] border border-cyan/20 bg-[linear-gradient(135deg,hsl(var(--card)/0.96),hsl(var(--card)/0.82))] shadow-[0_24px_80px_hsl(var(--background)/0.55)]">
              <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_28%),radial-gradient(circle_at_top_right,hsl(247_84%_72%/0.16),transparent_32%)] px-4 py-5 md:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-cyan">
                        <RadioTower className="h-3.5 w-3.5" />
                        IKUN 信号甲板
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-secondary">
                        未来行情控制台
                      </span>
                    </div>
                    <BrandMark subtitle="未来量化引擎" className="mb-4" />
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[2rem]">
                      IKUN 未来感股票分析驾驶舱
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-secondary">
                      先把 LLM 主渠道、Agent 渠道和自选股补齐，再开始首轮分析。这里直接告诉你现在缺什么、下一步去哪儿改、什么时候能开始试跑。
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:min-w-[360px] md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Setup Progress</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {setupStatus ? `${setupCompletedCount}/${setupChecks.length}` : '--'}
                      </p>
                      <p className="mt-1 text-xs text-secondary">已就绪项</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 backdrop-blur-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Required</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {setupStatus ? setupRequiredCount : '--'}
                      </p>
                      <p className="mt-1 text-xs text-secondary">关键启动项</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 backdrop-blur-sm col-span-2 md:col-span-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Smoke Status</p>
                      <p className={`mt-2 text-2xl font-semibold ${setupStatus?.readyForSmoke ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {setupStatus?.readyForSmoke ? 'READY' : 'PENDING'}
                      </p>
                      <p className="mt-1 text-xs text-secondary">最小可用分析</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 px-4 py-4 md:px-6 lg:grid-cols-[1.45fr_1fr]">
                <div className="grid gap-3 md:grid-cols-3">
                  {setupFocusChecks.map((check) => (
                    <div
                      key={check.key}
                      className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,hsl(var(--foreground)/0.05),hsl(var(--foreground)/0.025))] p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted">{check.category}</p>
                          <h2 className="mt-2 text-base font-semibold text-foreground">{check.title}</h2>
                        </div>
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${
                            check.status === 'configured'
                              ? 'border-emerald-400/30 bg-emerald-400/12 text-emerald-300'
                              : check.status === 'inherited'
                                ? 'border-cyan/30 bg-cyan/12 text-cyan'
                                : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                          }`}
                        >
                          {check.status === 'configured' ? (
                            <CheckCircle2 className="h-4.5 w-4.5" />
                          ) : check.key === 'llm_agent' ? (
                            <Bot className="h-4.5 w-4.5" />
                          ) : check.key === 'stock_list' ? (
                            <Star className="h-4.5 w-4.5" />
                          ) : (
                            <Sparkles className="h-4.5 w-4.5" />
                          )}
                        </span>
                      </div>
                      <p className="mt-3 min-h-[3.25rem] text-sm leading-6 text-secondary">{check.message}</p>
                      <button
                        type="button"
                        onClick={() => navigate(`/settings?category=${SETUP_CATEGORY_BY_KEY[check.key]}`)}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan transition-colors hover:text-white"
                      >
                        立即处理
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,hsl(var(--foreground)/0.05),hsl(var(--foreground)/0.02))] p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">First Run Checklist</p>
                      <h2 className="mt-2 text-base font-semibold text-foreground">
                        {setupNeedsAction ? '基础配置未完成' : '可以开始试跑'}
                      </h2>
                    </div>
                    <Settings2 className="h-5 w-5 text-cyan" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-secondary">
                    {setupNeedsAction
                      ? (setupMissingLabels
                        ? `当前缺少：${setupMissingLabels}。补齐后就能进入最小可用分析。`
                        : '仍有关键配置缺失，补齐后即可进入最小可用分析。')
                      : '关键启动项已经齐备，可以直接发起首轮分析或大盘复盘。'}
                  </p>

                  <div className="mt-4 space-y-2">
                    {setupChecks.map((check) => (
                      <div
                        key={check.key}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{check.title}</p>
                          <p className="mt-1 text-xs leading-5 text-secondary">{check.nextStep || check.message}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${
                          getSetupTone(check.status) === 'success'
                            ? 'bg-emerald-400/12 text-emerald-300'
                            : getSetupTone(check.status) === 'info'
                              ? 'bg-cyan/12 text-cyan'
                              : 'bg-amber-400/12 text-amber-300'
                        }`}>
                          {check.status === 'needs_action' ? 'TODO' : check.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="settings-primary"
                      onClick={() => navigate(`/settings?category=${setupStatus?.nextStepKey ? SETUP_CATEGORY_BY_KEY[setupStatus.nextStepKey] : 'ai_model'}`)}
                    >
                      打开配置中心
                    </Button>
                    <Button
                      type="button"
                      variant="settings-secondary"
                      onClick={() => navigate('/portfolio')}
                    >
                      查看自选股与持仓
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {marketReviewNotice ? (
              <div className="mb-3">
                <InlineAlert
                  variant={marketReviewNotice.variant}
                  title={marketReviewNotice.title}
                  message={marketReviewNotice.message}
                  className="rounded-xl px-3 py-2 text-xs shadow-none"
                />
              </div>
            ) : null}

            {marketReviewError ? (
              <div className="mb-3">
                <ApiErrorAlert
                  error={marketReviewError}
                  className="mb-1"
                  onDismiss={() => setMarketReviewError(null)}
                />
              </div>
            ) : null}

            {marketReviewReport ? (
              <div className="mb-3 rounded-xl border border-subtle bg-surface/70 px-3 py-3 text-xs text-secondary-text shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">大盘复盘报告</p>
                  <button
                    type="button"
                    className="home-surface-button h-7 rounded-md px-3 py-1 text-xs text-foreground"
                    disabled={marketReviewReportCopied}
                    onClick={() => void handleCopyMarketReviewReport()}
                  >
                    {marketReviewReportCopied ? '已复制' : '复制'}
                  </button>
                </div>
                <pre
                  data-testid="market-review-report"
                  className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-background px-3 py-2 leading-relaxed"
                >
                  {marketReviewReport}
                </pre>
              </div>
            ) : null}

            {error ? (
              <ApiErrorAlert
                error={error}
                className="mb-3"
                onDismiss={clearError}
              />
            ) : null}
            {isLoadingReport ? (
              <div className="flex h-full flex-col items-center justify-center">
                <DashboardStateBlock title="加载报告中..." loading />
              </div>
            ) : selectedReport ? (
              <div className="max-w-4xl space-y-4 pb-8">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="home-action-ai"
                    size="sm"
                    disabled={isAnalyzing || selectedReport.meta.id === undefined}
                    onClick={handleReanalyze}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {reportText.reanalyze}
                  </Button>
                  <Button
                    variant="home-action-ai"
                    size="sm"
                    disabled={selectedReport.meta.id === undefined}
                    onClick={handleAskFollowUp}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    追问 AI
                  </Button>
                  <Button
                    variant="home-action-ai"
                    size="sm"
                    disabled={selectedReport.meta.id === undefined}
                    onClick={openMarkdownDrawer}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {reportText.fullReport}
                  </Button>
                </div>
                <ReportSummary data={selectedReport} isHistory />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  title="开始分析"
                  description="输入股票代码进行分析，或从左侧选择历史报告查看。"
                  className="max-w-xl border-dashed"
                  icon={(
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )}
                />
              </div>
            )}
          </section>
        </div>
      </div>

      {markdownDrawerOpen && selectedReport?.meta.id ? (
        <ReportMarkdown
          recordId={selectedReport.meta.id}
          stockName={selectedReport.meta.stockName || ''}
          stockCode={selectedReport.meta.stockCode}
          reportLanguage={reportLanguage}
          onClose={closeMarkdownDrawer}
        />
      ) : null}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除历史记录"
        message={
          selectedHistoryIds.length === 1
            ? '确认删除这条历史记录吗？删除后将不可恢复。'
            : `确认删除选中的 ${selectedHistoryIds.length} 条历史记录吗？删除后将不可恢复。`
        }
        confirmText={isDeletingHistory ? '删除中...' : '确认删除'}
        cancelText="取消"
        isDanger={true}
        onConfirm={handleDeleteSelectedHistory}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default HomePage;
