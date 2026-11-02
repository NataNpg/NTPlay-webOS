# NTPlay — webOS (TVs LG)

Resumo técnico para futuras atualizações. Autor: **Natanael G Silva** · djnatan0@live.com
Situação em 02/11/2026 · repositório `NataNpg/NTPlay-webOS`

---

## 1. O que é

Player IPTV (listas M3U / Xtream Codes) para TVs LG com **webOS 4.0 ou mais novo** (2018+). É um app web empacotado (`.ipk`): HTML, CSS e JavaScript rodando no navegador da TV.

Usa a **mesma conta e a mesma nuvem** do NTPlay da TV Android. Quem entra com o usuário do painel recebe listas, favoritos, grupos e "continuar assistindo", nos dois sentidos.

- **Id do app:** `com.natanael.ntplay`
- **Versão:** `1.1.<execução do Actions>` (última publicada: 1.1.2). O `major.minor` vem do `package.json`.
- **Downloads (sempre a última):**
  - TV: https://github.com/NataNpg/NTPlay-webOS/releases/download/webos-latest/NTPlay-webOS.ipk
  - Simulador: https://github.com/NataNpg/NTPlay-webOS/releases/download/webos-latest/NTPlay-webOS-app.zip
  - Versão publicada: `.../webos-latest/webos-version.json`
- **Site (GitHub Pages):** https://natanpg.github.io/NTPlay-webOS/
  - Política de privacidade: `/privacidade.html`
  - Lista de demonstração (vídeos livres): `/demo.m3u`
  - Logos copiados do imgur: `/l/<id>.webp`

## 2. Tecnologias

| Item | Versão / detalhe |
|---|---|
| Linguagem | JavaScript (ES2020) transpilado pelo **esbuild** para `chrome53` (webOS 4 usa Chromium 53) |
| Interface | HTML/CSS próprios, 1920x1080; sem CSS grid e sem `gap` em flex (Chromium 53 não tem) |
| Player | `<video>` nativo do webOS, **hls.js 1.5.17** e **mpegts.js 1.7.3** como reserva |
| QR code | qrcode-generator 1.4.4 |
| Criptografia | WebCrypto: PBKDF2-SHA1 (40.000) e AES-256-GCM |
| Armazenamento | `localStorage` (preferências, conta, favoritos, progresso) e **IndexedDB** (listas brutas, cache de capas) |
| Empacotamento | `@webos-tools/cli` 3 (`ares-package`) |
| Logos | base pública iptv-org/database + `sharp` (redimensiona no Actions) |

**appinfo.json:** `resolution 1920x1080`, `disableBackHistoryAPI: true`, `requiredACG: []`, `bgColor`/`iconColor #070C1E` (igual ao fundo do ícone, exigência da loja).

## 3. Compilação e publicação

- **Local:** `npm ci` → `npm run build` (gera `dist/`) → `npx ares-package dist -o out`.
- **Workflow** `.github/workflows/webos.yml`, em todo push na `main` ou manual:
  1. baixa o iptv-org/database e gera `app/logos.json` (`tools/build-logos.mjs`);
  2. copia os logos do imgur para o site (`tools/mirror-logos.mjs`, com cache entre execuções) e troca no mapa por `~m<id>`;
  3. monta o site (`docs/` + logos) e publica no **GitHub Pages** (fonte "GitHub Actions");
  4. compila, empacota e recria a release **`webos-latest`** com `.ipk`, `.zip` do simulador e `webos-version.json`.
- **Atenção:** o pacote montado fora do Actions não tem os logos copiados (usa o imgur, que não abre na TV). Para testar logos, use sempre o zip da release.

## 4. Arquivos (`src/`)

| Arquivo | Função |
|---|---|
| `main.js` | Entrada: abertura, login ou app, sincronização a cada 90 s, revalida ao voltar para a frente, Voltar na tela inicial chama `platformBack` (volta ao Home). |
| `state.js` | Estado: listas, biblioteca, favoritos, grupos, progresso, conta e sincronização (porta do `AppState.kt`). |
| `sync.js` | Conta: derivação das chaves, cifra/decifra e chamadas ao `ntsync` (porta do `Sync.kt`). |
| `store.js` | `localStorage` e IndexedDB. |
| `library.js` | Leitura da M3U e montagem da biblioteca (porta do `Library.kt`); logos herdados entre versões do mesmo canal. |
| `util.js` | Normalização, ano, qualidade, episódio, classificação TV/filme/série, adulto, animes, LEG/DUB (porta do `Util.kt`). |
| `xtream.js` | API `player_api.php`: monta a M3U, episódios sob demanda, informações, conta, `get_short_epg`. |
| `player.js` | Player, ordem de tentativas, controles, legenda/áudio, pular abertura, próximo episódio, troca de canal, guia agora/a seguir. |
| `ui.js` | Telas: entrada, abas, grade, prateleiras, detalhes, busca, ☰ Listas, Futebol, caixas de diálogo. |
| `nav.js` | Navegação pelo controle (setas escolhem o elemento mais próximo), Magic Remote (ponteiro e roda), segurar OK. |
| `logos.js`, `logokey.js` | Logos dos canais pelo mapa `logos.json` (mesma chave do `Logos.kt`). |
| `covers.js` | Capas que faltam: Xtream → TVMaze → Wikipédia, conferidas antes de usar, cache em IndexedDB. |
| `futebol.js` | Aba Futebol (ESPN + programação dos canais). |
| `presence.js` | Contador anônimo (plataforma `webos`). |
| `net.js` | `fetch` com tempo-limite (sem AbortController no Chromium 53) e troca https→http. |

Outros: `tools/build-logos.mjs`, `tools/mirror-logos.mjs`, `store/LOJA-LG.md` (roteiro da loja), `store/icon-400.png`, `docs/privacidade.html`, `docs/demo.m3u`.

## 5. Funcionalidades prontas

**Acesso e conta**
- Tela de entrada obrigatória; contas criadas só no painel, com validade.
- Revalida a cada 90 s e ao reabrir; conta vencida, apagada ou com senha trocada trava o app. Sem internet, vale a última validade confirmada.
- Outro usuário na mesma TV: dados locais apagados antes de sincronizar.
- Nuvem compatível com a TV Android: mesmo payload (`lists`, `favs`, `groups`, `prog`) e **mesmas chaves de item** (`m:<url>`, `l:<url>`, `s:<grupo>|<título>`). Testado: blob no formato do Kotlin abre aqui e o que este app envia abre no formato da TV.
- Nome do aparelho no painel: "LG webOS TV".

**Listas**
- Várias listas ao mesmo tempo (ligar/desligar, atualizar, excluir), por link M3U ou Xtream (servidor, usuário e senha).
- Xtream pela API (evita o 522 do `get.php`); vencimento e telas em uso.
- Atualização automática opcional (ao abrir, 6/12/24 h).
- **Lista da nuvem que não baixa nesta TV** fica em `Store.pending`: aparece em vermelho em ☰ Listas, com o motivo e "Tentar de novo / Excluir". Continua no payload, então não some da TV Android. Nova tentativa automática a cada 30 min.
- **Ligar/desligar local vence a nuvem** quando houve mudança nesta TV.

**Navegação**
- Abas: Recomendações, TV ao vivo, Filmes, Séries, Animes (Todos/Crunchyroll/Funimation), Favoritos (com grupos), Futebol. **Sem aba Infantil** (removida a pedido); anime infantil fica em Animes.
- Barra lateral de categorias, grade que carrega 40 por vez, prateleiras de 20.
- Busca só de filmes e séries; filtro por ano; selos LEG/DUB.
- Segurar OK (ou botão vermelho) favorita.
- Magic Remote: passar o ponteiro foca, clique aciona, roda rola listas e prateleiras.

**Logos dos canais**
- Mapa do iptv-org dentro do app (`logos.json`, ~7.400 canais; países BR, PT, US, GB, INT, AR, MX).
- Nome oficial vale mais que apelido; redes BR genéricas por apelido fixo (SBT, Record, Band).
- Nome com o canal exato na base: logo da base primeiro, o da lista vira reserva. Nome genérico ("Globo RJ"): logo da lista primeiro.
- Logos do imgur servidos pela cópia no GitHub Pages; o imgur original é a reserva.
- Nome do canal escrito some quando o logo carrega (logo transparente não mistura com o texto).

**Capas**
- Só para cards que aparecem na tela, 3 de cada vez, guardadas no aparelho ("não achei" vale 7 dias).
- Ordem: servidor Xtream (`get_vod_info`/`get_series_info`) → TVMaze (séries) → Wikipédia pt e en (`pageimages`), aceitando só título igual e ano compatível.
- Imagem conferida carregando de verdade antes de aceitar; reserva pelo proxy `images.weserv.nl` (não funciona com imgur).
- Ordem de cada imagem na tela: lista → reserva → cópia/imgur → proxy → busca de capa. Imagem 1x1 conta como erro; 10 s sem carregar passa para a próxima.

**Player**
- Controles: ⏪10s / ⏯ / 10s⏩ / Próximo / Legenda / Áudio / Favoritar / Sair; ao vivo: ▼/▲ Canal e 📺 Canais (lista lateral).
- Continua de onde parou; pular abertura memorizado por série (`Store.intro`); próximo episódio automático; ◀ ▶ avançam/voltam 10 s; ⏪⏩ do controle 30 s; CH+/− trocam de canal.
- Guia agora/a seguir para canais Xtream (`get_short_epg`, a cada 2 min).
- **Ordem de tentativa:**
  - Ao vivo na TV real: `native` → `mpegts` → `.m3u8` (`native`/`hls`).
  - Ao vivo no simulador/PC: `mpegts` → `native` → `.m3u8`.
  - Filme/episódio: `native` → se for Xtream, o mesmo id em `.m3u8` (`native`/`hls`), `.mp4` e `.ts` (`mpegts`).
- mpegts.js com `fixAudioTimestampGap: false` (preencher buracos com silêncio atrasava a voz).
- Reconexão no ao vivo (até 8), inclusive quando o servidor fecha a conexão a cada pedaço.
- Erro mostra o tipo do arquivo e cada tentativa; no simulador avisa que faltam os decodificadores da TV.

**Futebol**
- Jogos do dia (ESPN, ~25 campeonatos), Ontem/Hoje/Amanhã.
- Programação de até 60 canais de esporte (Xtream, 5 por vez, cache 5 min): "● AGORA" ou o horário em que vai passar.

## 6. Loja LG (LG Content Store)

Roteiro completo em `store/LOJA-LG.md`. Resumo:
- **Vendedor:** LG Seller Lounge, pessoa física é aceita ("Individual Seller").
- **Arquivos:** `.ipk`, ícone 400x400 sem transparência e sem degradê (`store/icon-400.png`), abertura 1920x1080, checklist oficial preenchido, cenário de UX.
- **Conta de revisor:** `lgreview` com 365 dias, só com a lista de demonstração (`/demo.m3u`). Nunca a lista de canais pagos.
- **Textos do app ajustados para a loja:** "Peça seu acesso ao aplicativo" (sem oferecer lista) e aviso de que o NTPlay não fornece conteúdo.
- **Checklist atendido:** setas + OK + Voltar, ponteiro, roda, Voltar → Home, efeito de seleção, texto ≥ 20 px, indicação de carregamento, nada de senha no código.
- **Não atendido:**
  - botões de filtro com ~50 px de altura (a LG recomenda 75 px);
  - chaves da conta guardadas sem criptografia no armazenamento local.
- **Declarar o app como gratuito.** Cobrança por fora pode ser questionada.

## 7. Problemas conhecidos / pendências

1. **Primeiro teste em TV LG real em 02/11/2026** (1.1.x): app abre, login e listas funcionam, filmes e animes tocam. Problemas vistos: lista grande estourava a cota de armazenamento, ícones de texto viravam quadrado, capas e logos de sites https não apareciam (causa ainda não confirmada — usar o Diagnóstico), alguns canais 4K recusados pelo servidor (HTTP de erro no mpegts).
2. **Vídeo no simulador não vale como teste:** ele não tem os decodificadores da TV (MKV, H.265, AC3/Dolby). "Erro 4" no simulador não significa erro na TV.
3. **Áudio atrasado no ao vivo:** visto no simulador (mpegts.js). Corrigido pela ordem dos players e pela opção do mpegts; falta confirmar na TV.
4. **User-Agent fixo:** o navegador não deixa trocar. Servidor que só aceita "VLC" pode recusar (a TV Android não tem esse problema).
5. Canais entregues em pedaços de ~20 s e contas de 1 tela: sujeitos a travar na emenda, como na TV Android.
6. **Ficaram de fora:** guia XMLTV completo (só agora/a seguir das listas Xtream), "Em alta", capas do TMDB, atualização dentro do app (na loja quem atualiza é a LG).
7. **Sem logo ainda:** "Premiere 2" (a base só tem "Premiere FC 2"), "Discovery H&Health", regionais pouco conhecidos. Sem capa: títulos sem artigo na Wikipédia (ex.: "365 Dias Hoje").
8. Sem a loja, só roda em Modo Desenvolvedor (sessão de ~50 h, renovar no app) ou TV com Homebrew Channel.

## 8. Instalar e depurar na TV

1. Na TV: app **Developer Mode** (LG Content Store), entrar com conta de desenvolvedor LG, ligar *Dev Mode Status* e *Key Server*.
2. No PC:
   ```bash
   npx ares-setup-device                    # IP mostrado no Developer Mode, porta 9922
   npx ares-novacom --device tv --getkey    # passphrase mostrada na TV
   npx ares-install --device tv NTPlay-webOS.ipk
   npx ares-launch --device tv com.natanael.ntplay
   npx ares-inspect --device tv --app com.natanael.ntplay --open   # console do app
   ```
3. **Simulador:** extrair o zip numa pasta e abrir pelo botão **App** (não "Service").

## 9. Histórico

| Versão | Mudanças |
|---|---|
| 1.0.0 | Versão inicial: login e nuvem compatíveis com a TV Android, listas M3U/Xtream, abas, busca, séries, player, futebol, workflow do `.ipk` |
| 1.0.1 | Lista não desliga sozinha; listas da nuvem que falham não travam a sincronização; filme/episódio tenta outros formatos do servidor; erros mais claros |
| 1.0.2 | Logos dos canais pela base do iptv-org; aba Infantil removida; interface mais leve (sem desfoque/sombras/animações, grade de 40) |
| 1.0.3 | Logo exato da base primeiro; logo vazio/lento cai no reserva; nome escrito some atrás do logo |
| 1.0.4 | Capas sob demanda; preparação para a loja (roda do Magic Remote, texto ≥ 20 px, ícones sem transparência, política, lista de demonstração, roteiro) |
| 1.0.5 | Capas pela Wikipédia (o iTunes devolvia vazio), também para canais; proxy de imagens |
| 1.4.x | Prévia do canal na TV ao vivo (parado 1,2 s num canal: toca numa tela pequena à direita com agora/sinopse/a seguir; para antes de abrir em tela cheia, por causa do limite de telas); logos com mais variações de nome (Latin America, Channel, apelidos BR: Sony, Discovery H&H, Studio Universal…); espelho de logos respeita o limite da Wikimedia (era o motivo de ~900 logos não copiados); Wikipédia não é usada para título de uma palavra sem ano ("A Fera", "A Baleia"); imagem lenta passa para a próxima opção em 6 s |
| 1.3.x | Diagnóstico na TV (50UM7510PSB, webOS 4.5, Chrome 53): tudo abre menos o imgur. Causas das capas/logos faltando eram do Chrome 53: `fetch()` não lê o `logos.json` do próprio app (file://) → trocado por XMLHttpRequest; `Object.values` não existe (quebrava a busca de capas) → polyfills em `js-polyfill.js` (também para o hls.js); `IntersectionObserver` sem `isIntersecting`. Título conferido nos dois sentidos ("A Fera" ≠ "A Bela e a Fera"); sinopse pela Wikipédia (pt) e TVMaze (séries, inglês) quando o servidor não tem; capa achada nos detalhes atualiza o card; botão **Tela** no player (ajustar, preencher, esticar, zoom 110/125/140%, 4:3), guardado nas preferências |
| 1.2.x | Primeiro teste em TV real (LG). Listas guardadas comprimidas (~10x menores; antes estourava a cota da TV) e, se ainda assim não couberem, ficam na memória e são baixadas de novo ao abrir; ícones em SVG (símbolos de texto viravam quadrado na TV); botão Legenda removido do player; todos os logos da base copiados para o GitHub Pages; tela de Diagnóstico (☰ Listas → Preferências); erro do player mostra o código HTTP; API Xtream tenta 2x com 60 s e mostra o motivo; TV detectada também pelo User-Agent; capa não encontrada só fica marcada se a internet respondeu |
| 1.1.x | Logos do imgur copiados para o GitHub Pages; áudio do ao vivo (player nativo primeiro na TV, mpegts sem preencher silêncio); GitHub Pages ligado; versão = execução do Actions |
