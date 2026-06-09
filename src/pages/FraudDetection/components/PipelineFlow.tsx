import { CircleCheck as CheckCircle, Loader, Lock } from 'lucide-react';

const LAYERS = [
  { num: 1, label: 'Rules Engine',       color: '#8B5CF6', desc: 'Velocity, Amount, Geo, Device' },
  { num: 2, label: 'Feature Engineering', color: '#3B82F6', desc: '8-dimensional feature vector' },
  { num: 3, label: 'ML Algorithms',       color: '#F97316', desc: 'XGBoost + NN + Isolation Forest' },
  { num: 4, label: 'Explainability',      color: '#EC4899', desc: 'SHAP + Reason Codes + Alert' },
];

interface Props {
  currentLayer: 0 | 1 | 2 | 3 | 4;
  completedLayers: number[];
}

export function PipelineFlow({ currentLayer, completedLayers }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '12px 20px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
      {LAYERS.map((layer, i) => {
        const isActive = currentLayer === layer.num;
        const isDone   = completedLayers.includes(layer.num);
        const isPending = !isActive && !isDone;

        return (
          <div key={layer.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              flex: 1, padding: '8px 6px', borderRadius: 8, textAlign: 'center',
              background: isActive ? `${layer.color}18` : isDone ? `${layer.color}0C` : 'transparent',
              border: isActive ? `1px solid ${layer.color}66` : `1px solid ${isDone ? layer.color + '33' : 'transparent'}`,
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                {isDone ? (
                  <CheckCircle size={16} color={layer.color} />
                ) : isActive ? (
                  <Loader size={16} color={layer.color} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Lock size={14} color="var(--border-bright)" />
                )}
              </div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isActive ? layer.color : isDone ? layer.color : 'var(--border-bright)', letterSpacing: '0.06em' }}>
                LAYER {layer.num}
              </div>
              <div style={{ fontSize: 10, color: isActive ? '#E2E8F0' : isDone ? '#CBD5E1' : 'var(--status-neutral)', fontWeight: isActive ? 600 : 400, marginTop: 1 }}>
                {layer.label}
              </div>
              {isActive && (
                <div style={{ fontSize: 9, color: layer.color, marginTop: 2, animation: 'pulse-opacity 1s ease infinite' }}>
                  processing…
                </div>
              )}
              {isDone && (
                <div style={{ fontSize: 9, color: 'var(--border-bright)', marginTop: 2 }}>{layer.desc}</div>
              )}
            </div>
            {i < LAYERS.length - 1 && (
              <div style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                <div style={{
                  fontSize: 16, color: isDone ? LAYERS[i].color : 'var(--border-subtle)',
                  transition: 'color 0.3s',
                }}>→</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
