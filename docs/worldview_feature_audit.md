# WorldView Feature Audit

## Auditoria distribuída por subagents

> Coordenação do agente principal: varredura de arquitetura, renderização geoespacial, camadas de dados, UI visual e performance antes de alterações estruturais.

### 1) ARCHITECTURE_AUDITOR
- **Stack atual**
  - Monorepo Node com frontend React 17 (CRA) e backend Express + Mongoose.
  - Frontend desenha globo em `canvas` 2D customizado (não usa Three.js/Cesium/deck.gl).
  - Backend focado em autenticação/sessão e observabilidade (`/health`, `/metrics`).
- **Fluxo da aplicação**
  1. App inicia em tela de autenticação (`frontend/src/App.js`).
  2. Após login, renderiza `GodsEyeDashboard` com polling adaptativo de voos e polling independente de inteligência (satélite/seismic/CCTV/tráfego).
  3. `GlobeCanvas` recebe datasets filtrados e renderiza overlays no globo (trilhas, sensores, CCTV rays, seismic pulses, etc).
- **Componentes centrais**
  - `frontend/src/components/GodsEyeDashboard.js`
  - `frontend/src/components/GlobeCanvas.js`
  - `frontend/src/services/flights.js`
  - `frontend/src/services/intel.js`
- **Riscos de mudança**
  - O dashboard já concentra muito estado; mudanças grandes podem quebrar tracking e filtros.
  - Render loop é manual; qualquer layer adicional sem limitação pode impactar FPS.
  - Integrações externas (OpenSky/USGS/CCTV remota) possuem fallback mock; remover esse fallback quebra experiência offline.

### 2) GEOSPATIAL_RENDERING_AGENT
- **Detectado**
  - Já existe engine própria de globo em canvas com:
    - projeção geográfica,
    - camera modes (`overview`, `region`, `chase`, `sweep`),
    - seleção por hit test,
    - trilhas e overlays.
- **Conclusão técnica**
  - **Não recomendado** migrar agora para Three/Cesium: custo alto e risco de regressão.
  - Melhor evolução incremental: manter engine atual e modularizar camadas + telemetria.
- **Arquitetura proposta para objetos/rotas/câmera**
  - Padronizar metadados por layer e manter camera tracking acoplado a `selectedFlight`/`focusTarget` já existentes.

### 3) DATA_LAYERS_AGENT
- **Camadas já presentes**
  - Voos (OpenSky/ADS-BX/mock)
  - Satélites (live opcional + mock)
  - Terremotos (USGS + mock)
  - CCTV (API remota opcional + catálogo público + fallback)
  - Tráfego urbano (API remota opcional + mock)
- **Lacunas**
  - Não havia registry formal de layers com contrato único.
  - Faltava telemetria padronizada por camada (loading/erro/source/count).
- **Diretriz de segurança**
  - Continuar sem chaves reais em código.
  - `.env` para URLs/chaves opcionais.
  - fallback mock obrigatório quando feed real falhar.

### 4) UI_VISUAL_AGENT
- **Já existe**
  - Painel lateral rico, toggles, seleção de alvos, CCTV viewer, alertas, log e governança de fonte.
- **Gap encontrado**
  - Preset visual **high contrast** faltava.
  - Indicador consolidado de status por layer estava parcial (por fonte, não por contrato de camada).
- **Plano**
  - Adicionar preset `highContrast` no pipeline de skin.
  - Exibir telemetria por camada no painel (`status/source/count/error`).

### 5) PERFORMANCE_TEST_AGENT
- **Gargalos prováveis**
  - Alto volume de markers no loop do canvas.
  - Recomputação frequente de snapshots e trilhas.
- **Mitigações já existentes**
  - `useAdaptivePolling`, seleção por tier de qualidade, limites de render, throttling de cache.
- **Reforços sugeridos**
  - Registry de layers para habilitar/desabilitar claramente cada fonte.
  - Manter mock/demo para testes de UI sem depender de rede.

---

## Inventário: o que já existe
- Globo 3D-like em canvas com câmera e tracking.
- Sistema de camadas operacionais (satélite, seismic, CCTV, street traffic, voos).
- Seleção de objetos e acompanhamento de voo.
- Presets visuais: default, CRT, night vision, FLIR.
- Polling adaptativo, limites de histórico, heurísticas de qualidade/performance.

## O que estava incompleto antes desta rodada
- Arquitetura formal de layers com contrato comum e registry central.
- Preset visual `high contrast`.
- Telemetria homogênea de camadas para loading/erro/count/source.
- Testes mínimos focados em lógica crítica de camadas.

## Bugs/limitações percebidas
- Estado de camada espalhado em múltiplos hooks (`intelLayers`, snapshot sources, status textual).
- Dependência forte de um componente dashboard monolítico.
- Sem testes automatizados para contrato de camadas.

## Plano de implementação (prioridade)
1. **Arquitetura de layers** (registry + contratos + módulos por camada).
2. **Mock/demo data** no próprio registry para garantir operação mesmo sem APIs externas.
3. **UI de controle**: status por camada (loading/erro/source/count).
4. **Seleção/tracking**: preservar comportamento atual e manter compatibilidade.
5. **Modos visuais**: incluir `high contrast`.
6. **Integrações reais opcionais**: já parcialmente cobertas, manter guardrails de env.
7. **Performance**: manter estratégia de quality tier e polling adaptativo.
8. **Documentação**: este relatório + atualização futura do README com arquitetura de layers.

## Arquivos planejados para modificação
- `frontend/src/components/GodsEyeDashboard.js`
- `frontend/src/components/GlobeCanvas.js`
- `frontend/src/config/constants.js`
- `frontend/src/layers/layerRegistry.js`
- `frontend/src/layers/types.js`
- `frontend/src/layers/satelliteLayer/index.js`
- `frontend/src/layers/flightLayer/index.js`
- `frontend/src/layers/trafficLayer/index.js`
- `frontend/src/layers/cctvLayer/index.js`
- `frontend/src/layers/earthquakeLayer/index.js`
- `frontend/src/layers/demoLayer/index.js`
- `frontend/src/layers/__tests__/layerRegistry.test.js`
