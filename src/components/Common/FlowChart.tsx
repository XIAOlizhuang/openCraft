import type { FlowNode } from '@/types'

interface FlowChartProps {
  flow: FlowNode | undefined | null
  apis: Record<string, { name: string; method: string }>
}

function getApi(id: string, apis: Record<string, { name: string; method: string }>) {
  return apis[id] || { name: id, method: '?' }
}

function FlowNodeComponent({ step, apis }: { step: FlowNode; apis: Record<string, { name: string; method: string }> }) {
  const localGetApi = (id: string) => apis[id] || { name: id, method: '?' }

  if (step.type === 'api') {
    const api = localGetApi(step.apiId || '')
    return (
      <div className="flex items-center gap-2.5 mb-2">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
            api.method === 'GET'
              ? 'bg-[#e8ffea] text-[#00b42a]'
              : api.method === 'POST'
              ? 'bg-[#e8f3ff] text-[#165dff]'
              : api.method === 'PUT'
              ? 'bg-[#fff7e8] text-[#ff7d00]'
              : 'bg-[#ffe8e8] text-[#f53f3f]'
          }`}
        >
          {api.method}
        </span>
        <div className="flex-1 px-3.5 py-2.5 rounded-md text-[13px] border border-[#e5e6eb] bg-white flex items-center gap-2">
          {api.name}
        </div>
      </div>
    )
  }

  if (step.type === 'parallel') {
    const children: FlowNode[] = step.children || step.steps || []
    return (
      <div className="my-2">
        <div className="text-[11px] text-[#86909c] text-center mb-1.5">{step.label || '并行执行'}</div>
        <div className="flex gap-2.5">
          {children.map((s: FlowNode, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              {s.type === 'api' ? (
                <div className="w-full px-3.5 py-2.5 rounded-md text-[13px] border border-[#ff7d00] bg-[#fff7e8] flex items-center justify-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      localGetApi(s.apiId || '').method === 'GET'
                        ? 'bg-[#e8ffea] text-[#00b42a]'
                        : localGetApi(s.apiId || '').method === 'POST'
                        ? 'bg-[#e8f3ff] text-[#165dff]'
                        : localGetApi(s.apiId || '').method === 'PUT'
                        ? 'bg-[#fff7e8] text-[#ff7d00]'
                        : 'bg-[#ffe8e8] text-[#f53f3f]'
                    }`}
                  >
                    {localGetApi(s.apiId || '').method}
                  </span>
                  <div>{localGetApi(s.apiId || '').name}</div>
                </div>
              ) : (
                <div className="w-full px-3.5 py-2.5 rounded-md text-[13px] border border-[#ff7d00] bg-[#fff7e8] flex items-center justify-center">
                  {s.label || s.type}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (step.type === 'sequence' && step.steps) {
    return (
      <div>
        {step.steps.map((s: FlowNode, i: number) => (
          <div key={i}>
            <FlowNodeComponent step={s} apis={apis} />
            {i < step.steps!.length - 1 && (
              <div className="flex justify-center text-[#c9cdd4] text-sm py-1">↓</div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return null
}

export default function FlowChart({ flow, apis }: FlowChartProps) {
  if (!flow) {
    return <div className="text-[#86909c] text-[13px]">暂无流程定义</div>
  }

  if (flow.type === 'sequence' && flow.steps) {
    return (
      <div>
        {flow.steps.map((step, idx) => (
          <div key={idx}>
            <FlowNodeComponent step={step} apis={apis} />
            {idx < flow.steps!.length - 1 && (
              <div className="flex justify-center text-[#c9cdd4] text-sm py-1">↓</div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (flow.type === 'api') {
    const api = getApi(flow.apiId || '', apis)
    return (
      <div className="flex items-center gap-2.5">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
            api.method === 'GET'
              ? 'bg-[#e8ffea] text-[#00b42a]'
              : api.method === 'POST'
              ? 'bg-[#e8f3ff] text-[#165dff]'
              : api.method === 'PUT'
              ? 'bg-[#fff7e8] text-[#ff7d00]'
              : 'bg-[#ffe8e8] text-[#f53f3f]'
          }`}
        >
          {api.method}
        </span>
        <div className="flex-1 px-3.5 py-2.5 rounded-md text-[13px] border border-[#e5e6eb] bg-white flex items-center gap-2">
          {api.name}
        </div>
      </div>
    )
  }

  return <div className="text-[#86909c] text-[13px]">暂无流程定义</div>
}
