# NTPlay — envio para a LG Content Store

Roteiro do que preencher no **LG Seller Lounge** (https://seller.lgappstv.com). Vale para vendedor pessoa física
("Individual Seller"): o nome cadastrado aparece como vendedor na loja.

## 1. Antes de enviar

1. **Conta de teste para o revisor** — crie no painel (`contas.html`) a conta `lgreview` com validade de 365 dias.
   Entre com ela no simulador ou na TV e adicione **somente** a lista de demonstração
   `https://natanpg.github.io/NTPlay-webOS/demo.m3u` (vídeos livres e públicos de teste: Akamai, Apple, Google Shaka, Mux, Unified Streaming e filmes abertos da Blender Foundation — conferidos em 02/11/2026; os vídeos de exemplo do Google que estavam antes saíram do ar).
   Nunca entregue ao revisor uma lista com canais pagos/TV fechada: é recusa na hora e expõe você.
2. **Política de privacidade publicada** — ative o GitHub Pages do repositório (Settings → Pages → branch `main`,
   pasta `/docs`). Endereço: `https://natanpg.github.io/NTPlay-webOS/privacidade.html`.
3. **Teste na TV real** em Modo Desenvolvedor: abrir, entrar, navegar só com setas/OK/Voltar, navegar só com o
   ponteiro do Magic Remote, rolar listas com a roda, tocar vídeo, Voltar na tela inicial (deve voltar ao Home).
4. **Capturas de tela** 1920x1080 tiradas do simulador com a lista de demonstração (tela inicial, filmes, detalhes,
   player). Nada de logos de canais pagos nas capturas.

## 2. Arquivos

| Item | Arquivo | Regra da LG |
|---|---|---|
| Pacote | `NTPlay-webOS.ipk` (release `webos-latest`) | id `com.natanael.ntplay` |
| Ícone da loja | `store/icon-400.png` | 400x400, PNG/JPG, sem transparência, sem degradê no fundo |
| Cor do bloco | `#070C1E` | igual ao fundo do ícone (já está no `appinfo.json`) |
| Abertura | `app/img/splash.png` | PNG 1920x1080 (JPG é recusado: "Wrong splashBackground file format") |
| Ícones no pacote | `app/img/icon80.png`, `icon130.png` | já sem transparência |
| Checklist | formulário oficial do Seller Lounge | obrigatório; preencher com resultado real |
| Cenário de UX | modelo do Seller Lounge | texto da seção 4 abaixo |

## 3. Textos da loja

**Título:** NTPlay

**Descrição (pt-BR):**
> NTPlay é um reprodutor de listas de vídeo M3U e Xtream Codes para TVs LG. Adicione as suas listas, organize
> canais, filmes e séries, continue de onde parou e sincronize favoritos e progresso entre aparelhos com a sua
> conta NTPlay, com criptografia de ponta a ponta. Recursos: várias listas ao mesmo tempo, guia "agora/a seguir",
> busca, filtro por ano, temporadas e episódios, pular abertura, próximo episódio automático, favoritos e grupos,
> controle remoto e Magic Remote.
> O NTPlay não fornece, vende nem inclui canais, filmes ou listas. É necessário ter uma conta NTPlay e as suas
> próprias listas.

**Description (en):**
> NTPlay is an M3U / Xtream Codes playlist player for LG TVs. Add your own playlists, browse live channels,
> movies and series, resume where you left off and sync favorites and progress across devices with an
> end-to-end encrypted NTPlay account. NTPlay does not provide, sell or include any channels, movies or playlists.
> An NTPlay account and your own playlists are required.

**Palavras-chave:** player, m3u, xtream, playlist, reprodutor, vídeo, hls, lista, iptv player

**Categoria:** Entretenimento / Vídeo. **Classificação:** livre de conteúdo próprio (o app não traz conteúdo).

## 4. Cenário de UX (para o revisor)

1. Abra o app. Tela de entrada: Usuário `lgreview`, Senha `<a senha da conta>` → **Entrar**.
2. Tela inicial (Recomendações). Use ◀ ▶ nas abas: TV AO VIVO, FILMES, SÉRIES, ANIMES, FAVORITOS, FUTEBOL.
3. **TV AO VIVO** → ▼ até um canal → **OK** reproduz. ▲/▼ ou CH+/− trocam de canal. **Voltar** sai do player.
4. **FILMES** → escolha "Big Buck Bunny" ou "Sintel" → **OK** abre detalhes → **▶ Assistir**. ◀/▶ volta/avança 10 s;
   OK mostra os controles (legenda, áudio, favoritar, sair).
5. **SÉRIES** → "Blender Open Movies" → temporadas e episódios → OK em um episódio.
6. Segure **OK** (ou botão vermelho) sobre um título para favoritar; ele aparece em FAVORITOS.
7. **🔍 Buscar** → digite com o teclado virtual → resultados.
8. **☰ Listas** → conta (sincronizar/sair), listas (ligar/desligar, atualizar, excluir), adicionar lista
   (Xtream ou M3U), preferências.
9. **Voltar** na tela inicial → volta para a tela Home da TV.

## 5. Notas para o revisor (campo de observações)

> Test account: user `lgreview` / password `…` (valid until …). The account already contains a demo playlist with
> royalty-free public test streams (Akamai, Apple, Google Shaka, Mux, Unified Streaming) and Blender Foundation open movies (CC-BY). NTPlay is a player only and does
> not provide content; users add their own M3U/Xtream playlists. Login is required because favorites and playback
> progress are synced (end-to-end encrypted) across the user's devices.

## 6. Itens do checklist que costumam reprovar e como o app está

| Item | Situação |
|---|---|
| Tudo operável com 4 setas + OK + Voltar | sim |
| Tudo operável com o ponteiro + OK | sim (passar o ponteiro foca, clique aciona) |
| Roda do Magic Remote rola as listas | sim (1.0.4) |
| Voltar na tela inicial vai para o Home | sim (`platformBack`) |
| Todo item selecionável tem efeito de seleção | sim (fundo branco / borda branca) |
| Texto mínimo 20 px | sim (1.0.4) |
| Botões de no mínimo 75x75 px | **não em tudo** (recomendado, não obrigatório): botões pequenos de filtro têm ~50 px de altura |
| Indicação de carregamento | sim (abertura e "Carregando…") |
| Senhas/chaves no código | nenhuma; só o endereço público do servidor de contas |
| Dados sensíveis guardados criptografados | **parcial**: as chaves derivadas da conta ficam no armazenamento local do app |
| Conteúdo impróprio (adulto etc.) | adulto escondido por padrão; o app não traz conteúdo |

## 7. Riscos que continuam

- O app exige login com conta criada por você. Se a conta de teste vencer durante a revisão, reprova.
- Se a loja perguntar sobre pagamento: a venda de acesso fora da loja pode exigir explicação. Declare o app como
  **gratuito**. Cobrar acesso por fora sem usar o pagamento da LG pode ser questionado.
- Atualizações do app passam por nova revisão a cada envio.

## 8. Envio feito — 02/11/2026

- Status no Seller Lounge: **QA Request** (empacotamento aceito). Não clicar em "Request Cancel".
- Pacotes 1.4.7: `NTPlay-webOS-1920x1080.ipk` (TVs UHD) e `NTPlay-webOS-1280x720.ipk` (TVs FHD; build com `RES=1280x720`, a interface é reduzida por zoom em `app/js-polyfill.js`).
- País de serviço: só Brasil. Idioma: Português. Dados salvos: Canadá (Supabase ca-central-1).
- Faturamento: terceiros, Assinatura (SVOD), fora do app (Pix / link). Sem anúncio. Geo IP: Não.
- Self-check: N/A em 4, 11, 12, 18, 19, 23, 24, 25, 41, 42, 48, 52; Pass no resto.
- Risco conhecido: "Mostrar conteúdo adulto" liga sem PIN (item 23). Se a LG reprovar por isso, pôr PIN e mandar 1.4.8.
- Regra da LG: 5 recusas seguidas (ou 3 pelo mesmo problema) = 3 meses sem poder enviar. Ler o motivo antes de reenviar.
