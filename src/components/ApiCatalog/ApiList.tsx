import { useCallback, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { apiCatalogApi } from '@/services/api'
import type { ApiEndpoint } from '@/types'

export default function ApiList() {
  const store = useStore()
  const {
    apis,
    filteredApis,
    apiSearch,
    loadingApis,
    rightPanelView,
    pendingCreation,
    selectedApi,
  } = store

  useEffect(() => {
    fetchApis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchApis = async () => {
    store.setLoadingApis(true)
    try {
      const res = await apiCatalogApi.list()
      store.setApis(res.data.items || [])
      store.setFilteredApis(res.data.items || [])
    } catch (e: any) {
      store.showToast('服务加载失败：' + e.message, 'error')
    } finally {
      store.setLoadingApis(false)
    }
  }

  const onSearchInput = useCallback(
    (value: string) => {
      store.setApiSearch(value)
      const q = value.trim().toLowerCase()
      if (!q) {
        store.setFilteredApis(apis)
        return
      }
      store.setFilteredApis(
        apis.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.path.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        )
      )
    },
    [apis, store]
  )

  const switchToDigitalTwin = () => {
    store.setRightPanelView('digital_twin')
  }

  const switchToOther = () => {
    store.setRightPanelView('other')
  }

  const selectApi = (api: ApiEndpoint) => {
    store.setSelectedApi(api)
  }

  const addApiToDraft = (api: ApiEndpoint) => {
    if (!pendingCreation) return
    const flow = (pendingCreation.flow as any) || { type: 'sequence', steps: [] }
    const steps = [...(flow.steps || [])]
    if (steps.some((s: any) => s.apiId === api.id)) {
      store.showToast('该接口已在流程中', 'error')
      return
    }
    steps.push({ type: 'api', apiId: api.id, label: api.name })
    const interfaces = [...(pendingCreation.interfaces as string[] || [])]
    if (!interfaces.includes(api.id)) interfaces.push(api.id)
    store.setPendingCreation({ ...pendingCreation, flow: { ...flow, steps }, interfaces })
    store.showToast('已添加到草稿流程', 'success')
  }

  const digitalTwinApis = filteredApis.filter((a) => !a.category || a.category === 'power_digital_twin')

  const filteredOtherApis = filteredApis.filter((a) => a.category === 'other')

  // Tag filter logic: if search matches a domain keyword, filter by domain
  const isDomainFilter = (search: string) => {
    const domainMap: Record<string, string[]> = {
      '电网中台': ['grid-'],
      '巡视': ['patrol'],
      '缺陷': ['defect'],
      '作业': ['WMCenter'],
      '避雷器': ['arrester'],
      '变电站': ['substation', 'station'],
      '线路': ['line', 'lines'],
      '变压器': ['transformer'],
      '开关柜': ['switchgear'],
    }
    for (const [tag, kws] of Object.entries(domainMap)) {
      if (search === tag) {
        return kws
      }
    }
    return null
  }

  const getDisplayApis = () => {
    const q = apiSearch.trim()
    const kws = isDomainFilter(q)
    if (kws) {
      return digitalTwinApis.filter((a) =>
        kws.some((kw) =>
          a.id.toLowerCase().includes(kw.toLowerCase()) ||
          a.name.toLowerCase().includes(kw.toLowerCase()) ||
          a.path.toLowerCase().includes(kw.toLowerCase()) ||
          (a.domain || '').toLowerCase().includes(kw.toLowerCase()) ||
          (a.keywords || []).some((k) => k.toLowerCase().includes(kw.toLowerCase()))
        )
      )
    }
    return digitalTwinApis
  }

  const displayApis = getDisplayApis()

  // ---------------------------------------------------------------------------
  // Business-friendly helpers
  // ---------------------------------------------------------------------------

  const cleanName = (name: string) => name.replace(/^【中台】/, '').trim()

  const domainMeta = (domain?: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      auth: { label: '鉴权', color: '#722ed1', bg: '#f5e8ff' },
      patrol: { label: '巡视', color: '#00b42a', bg: '#e8ffea' },
      defect: { label: '缺陷', color: '#f53f3f', bg: '#ffe8e8' },
      fault: { label: '故障', color: '#f53f3f', bg: '#ffe8e8' },
      hidden_danger: { label: '隐患', color: '#ff7d00', bg: '#fff7e8' },
      resource: { label: '资源', color: '#165dff', bg: '#e8f3ff' },
      asset: { label: '资产', color: '#165dff', bg: '#e8f3ff' },
      graph: { label: '图模', color: '#0fc6c2', bg: '#e8fffb' },
      topology: { label: '拓扑', color: '#0fc6c2', bg: '#e8fffb' },
      weather: { label: '气象', color: '#165dff', bg: '#e8f3ff' },
      measure: { label: '测点', color: '#ff7d00', bg: '#fff7e8' },
      base: { label: '基础', color: '#86909c', bg: '#f2f3f5' },
      overhaul: { label: '检修', color: '#ff7d00', bg: '#fff7e8' },
      repair: { label: '抢修', color: '#f53f3f', bg: '#ffe8e8' },
      test: { label: '试验', color: '#722ed1', bg: '#f5e8ff' },
      ticket: { label: '工单', color: '#165dff', bg: '#e8f3ff' },
      work_management: { label: '作业', color: '#ff7d00', bg: '#fff7e8' },
      forecast: { label: '预测', color: '#165dff', bg: '#e8f3ff' },
      transformer: { label: '变压器', color: '#ff7d00', bg: '#fff7e8' },
      line: { label: '线路', color: '#0fc6c2', bg: '#e8fffb' },
      substation: { label: '变电站', color: '#165dff', bg: '#e8f3ff' },
      arrester: { label: '避雷器', color: '#ff7d00', bg: '#fff7e8' },
      switchgear: { label: '开关柜', color: '#f53f3f', bg: '#ffe8e8' },
      cable: { label: '电缆', color: '#0fc6c2', bg: '#e8fffb' },
      dga: { label: '油色谱', color: '#722ed1', bg: '#f5e8ff' },
      device: { label: '设备', color: '#86909c', bg: '#f2f3f5' },
    }
    return map[domain || ''] || { label: domain || '服务', color: '#86909c', bg: '#f2f3f5' }
  }

  const extractOutputFields = (api: ApiEndpoint): string[] => {
    // Prefer explicit fields array (already curated for business use)
    if (api.fields && api.fields.length > 0) {
      return api.fields.map((f: any) => f.description || f.name).slice(0, 4)
    }
    // Fallback: try response_schema -> result -> records -> items properties
    try {
      const rs = api.response_schema as any
      const records = rs?.properties?.result?.properties?.records?.items?.properties
      if (records) {
        return Object.values(records)
          .map((p: any) => p.description || p.name)
          .filter(Boolean)
          .slice(0, 4)
      }
    } catch {
      // ignore
    }
    return []
  }

  const extractInputNeeds = (api: ApiEndpoint): string[] => {
    try {
      const req = api.request_schema as any
      const props = req?.properties || {}
      const required = req?.required || []
      const result: string[] = []
      for (const [key, val] of Object.entries(props)) {
        const v = val as any
        const isRequired = required.includes(key)
        if (isRequired && v.description) {
          result.push(v.description)
        }
      }
      return result.slice(0, 3)
    } catch {
      return []
    }
  }

  const extractTransformSummary = (api: ApiEndpoint): string[] => {
    const t = api.transform as any
    if (!t?.extract) return []
    return (t.extract as any[])
      .filter((ex) => ex.name)
      .map((ex) => `${ex.name}${ex.dedup ? '（去重）' : ''}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs - 胶囊按钮风格 */}
      <div className="flex justify-center py-3 px-4">
        <div className="inline-flex bg-[#f2f3f5] rounded-full p-1">
          <div
            className={`px-4 py-1.5 text-[13px] cursor-pointer rounded-full transition-all duration-300 ${
              rightPanelView === 'digital_twin'
                ? 'bg-white text-[#165dff] font-medium shadow-sm'
                : 'text-[#86909c] hover:text-[#4e5969]'
            }`}
            onClick={switchToDigitalTwin}
          >
            电网数字孪生服务
          </div>
          <div
            className={`px-4 py-1.5 text-[13px] cursor-pointer rounded-full transition-all duration-300 ${
              rightPanelView === 'other'
                ? 'bg-white text-[#165dff] font-medium shadow-sm'
                : 'text-[#86909c] hover:text-[#4e5969]'
            }`}
            onClick={switchToOther}
          >
            扩展服务
          </div>
        </div>
      </div>

      {rightPanelView === 'digital_twin' && (
            <>
              {/* Search */}
              <div className="p-3 border-b border-[#e5e6eb]">
                <input
                  className="w-full px-2.5 py-2 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff]"
                  value={apiSearch}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder="搜索服务..."
                />
              </div>
              {/* Quick filter tags */}
              {/* <div className="flex gap-1.5 px-3 pb-2.5 flex-wrap">
                {['全部', '电网中台', '巡视', '缺陷', '避雷器', '变电站', '线路', '变压器', '开关柜'].map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-1 rounded cursor-pointer border transition-colors ${
                      (tag === '全部' && apiSearch === '') || apiSearch === tag
                        ? 'bg-[#165dff] text-white border-[#165dff]'
                        : 'bg-[#f2f3f5] text-[#4e5969] border-[#e5e6eb] hover:border-[#165dff] hover:text-[#165dff] hover:bg-[#e8f3ff]'
                    }`}
                    onClick={() => onSearchInput(tag === '全部' ? '' : tag)}
                  >
                    {tag}
                  </span>
                ))}
              </div> */}
              {/* List */}
              <div className="flex-1 overflow-y-auto p-3">
                {loadingApis ? (
                  <div className="flex flex-col items-center justify-center py-5 text-[#86909c]">
                    <div className="flex gap-1 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.2s]" />
                    </div>
                    <span className="text-sm">加载中...</span>
                  </div>
                ) : displayApis.length === 0 ? (
                  <div className="text-center py-5 text-[#86909c] text-sm">暂无服务</div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {displayApis.map((api) => {
                      const isSelected = selectedApi?.id === api.id
                      const meta = domainMeta(api.domain)
                      const outputFields = extractOutputFields(api)
                      const inputNeeds = extractInputNeeds(api)
                      const transformSummary = extractTransformSummary(api)

                      return (
                        <div
                          key={api.id}
                          className={`border rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#165dff] bg-white shadow-sm'
                              : 'border-[#e5e6eb] bg-white hover:border-[#165dff] hover:shadow-sm'
                          }`}
                          onClick={() => selectApi(api)}
                        >
                          {/* Card header */}
                          <div className="px-3.5 py-3">
                            <div className="flex items-start gap-2">
                              <span
                                className="shrink-0 text-[10px] px-[6px] py-[2px] rounded font-medium leading-none mt-0.5 truncate max-w-[72px]"
                                style={{ color: meta.color, backgroundColor: meta.bg }}
                              >
                                {meta.label}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    title={cleanName(api.name)}
                                    className={`text-[13px] font-semibold leading-snug break-words ${
                                      isSelected ? 'text-[#165dff]' : 'text-[#1a1a1a]'
                                    }`}
                                  >
                                    {cleanName(api.name)}
                                  </span>
                                </div>
                                <p className="text-xs text-[#86909c] mt-1 leading-relaxed line-clamp-2">
                                  {api.description}
                                </p>
                              </div>
                              {pendingCreation && (
                                <button
                                  className="shrink-0 text-xs text-[#165dff] bg-[#e8f3ff] border border-[#165dff] px-2 py-1 rounded hover:bg-[#165dff] hover:text-white transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    addApiToDraft(api)
                                  }}
                                  title="添加到当前草稿"
                                >
                                  + 添加
                                </button>
                              )}
                            </div>

                            {/* Output fields: what data can I get? */}
                            {outputFields.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                <span className="text-[11px] text-[#86909c] leading-5">可获取：</span>
                                {outputFields.map((f, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] px-2 py-[2px] rounded bg-[#f2f3f5] text-[#4e5969] border border-[#e5e6eb]"
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Expanded detail for selected API */}
                          {isSelected && (
                            <div className="px-3.5 pb-3.5">
                              <div className="border-t border-dashed border-[#e5e6eb] pt-2.5 space-y-2.5">
                                {inputNeeds.length > 0 && (
                                  <div>
                                    <div className="text-[11px] font-medium text-[#1a1a1a] mb-1.5">输入条件</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {inputNeeds.map((need, idx) => (
                                        <span key={idx} className="text-[11px] px-2 py-[2px] rounded bg-[#fff7e8] text-[#ff7d00] border border-[#ff7d00]/20">
                                          {need}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {transformSummary.length > 0 && (
                                  <div>
                                    <div className="text-[11px] font-medium text-[#1a1a1a] mb-1.5">自动提取</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {transformSummary.map((t, idx) => (
                                        <span key={idx} className="text-[11px] px-2 py-[2px] rounded bg-[#e8f3ff] text-[#165dff] border border-[#165dff]/20">
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="text-[10px] text-[#86909c] mt-1">提取结果可供下游步骤直接使用，无需手动配置。</div>
                                  </div>
                                )}
                                {(api.retry as any)?.maxAttempts > 0 && (
                                  <div className="flex items-center gap-1 text-[11px] text-[#86909c]">
                                    <span>失败时自动重试最多 {(api.retry as any).maxAttempts} 次</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {rightPanelView === 'other' && (
            <>
              {/* Search */}
              <div className="p-3 border-b border-[#e5e6eb]">
                <input
                  className="w-full px-2.5 py-2 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff]"
                  value={apiSearch}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder="搜索服务..."
                />
              </div>
              {/* List */}
              <div className="flex-1 overflow-y-auto p-3">
                {loadingApis ? (
                  <div className="flex flex-col items-center justify-center py-5 text-[#86909c]">
                    <div className="flex gap-1 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.2s]" />
                    </div>
                    <span className="text-sm">加载中...</span>
                  </div>
                ) : filteredOtherApis.length === 0 ? (
                  <div className="text-center py-5 text-[#86909c] text-sm">暂无其他服务</div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {filteredOtherApis.map((api) => {
                      const isSelected = selectedApi?.id === api.id
                      const meta = domainMeta(api.domain)
                      const outputFields = extractOutputFields(api)
                      return (
                        <div
                          key={api.id}
                          className={`border rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#165dff] bg-white shadow-sm'
                              : 'border-[#e5e6eb] bg-white hover:border-[#165dff] hover:shadow-sm'
                          }`}
                          onClick={() => selectApi(api)}
                        >
                          <div className="px-3.5 py-3">
                            <div className="flex items-start gap-2">
                              <span
                                className="shrink-0 text-[10px] px-[6px] py-[2px] rounded font-medium leading-none mt-0.5 truncate max-w-[72px]"
                                style={{ color: meta.color, backgroundColor: meta.bg }}
                              >
                                {meta.label}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`text-[13px] font-semibold leading-snug break-words ${
                                    isSelected ? 'text-[#165dff]' : 'text-[#1a1a1a]'
                                  }`}
                                >
                                  {cleanName(api.name)}
                                </span>
                                <p className="text-xs text-[#86909c] mt-1 leading-relaxed line-clamp-2">
                                  {api.description}
                                </p>
                              </div>
                              {pendingCreation && (
                                <button
                                  className="shrink-0 text-xs text-[#165dff] bg-[#e8f3ff] border border-[#165dff] px-2 py-1 rounded hover:bg-[#165dff] hover:text-white transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    addApiToDraft(api)
                                  }}
                                  title="添加到当前草稿"
                                >
                                  + 添加
                                </button>
                              )}
                            </div>
                            {outputFields.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                <span className="text-[11px] text-[#86909c] leading-5">可获取：</span>
                                {outputFields.map((f, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] px-2 py-[2px] rounded bg-[#f2f3f5] text-[#4e5969] border border-[#e5e6eb]"
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
    </div>
  )
}
