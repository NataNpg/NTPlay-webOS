# NTPlay — webOS (TVs LG)

Player IPTV (M3U e Xtream Codes) para TVs LG com webOS 4.0 ou mais novo (2018+).
Usa a **mesma conta e a mesma nuvem** do NTPlay da TV Android: quem entra com o usuário do painel
recebe as listas, favoritos, grupos e o “continuar assistindo”, nos dois sentidos.

Download (sempre a última): https://github.com/NataNpg/NTPlay-webOS/releases/download/webos-latest/NTPlay-webOS.ipk

## O que tem

- Entrada obrigatória com usuário e senha do painel (`ntsync`), validade revalidada a cada 90 s e ao voltar para o app.
- Nuvem compatível com a TV Android: PBKDF2-SHA1 (40.000), AES-256-GCM, mesmo formato de dados e as mesmas chaves de item.
- Listas M3U e Xtream Codes (pela API `player_api.php`), várias ao mesmo tempo; vencimento e telas da conta Xtream.
- Abas: Recomendações, TV ao vivo, Filmes, Séries, Infantil, Animes (Crunchyroll/Funimation), Favoritos (com grupos), Futebol.
- Busca só de filmes e séries, filtro por ano, selos LEG/DUB.
- Séries com temporadas; episódios Xtream carregados ao abrir; sinopse, capa e nota do próprio servidor.
- Player: vídeo nativo do webOS (HLS, MP4, MKV, TS) com hls.js e mpegts.js de reserva; reconexão no ao vivo;
  continuar de onde parou; pular abertura memorizado por série; próximo episódio; legenda e áudio quando a TV informa as faixas;
  troca de canal (▲▼ e CH+/−), lista de canais e guia agora/a seguir (Xtream).
- Futebol: jogos do dia (ESPN) e o canal da lista que passa cada jogo pela programação.
- Controle remoto comum e Magic Remote. Segurar OK (ou botão vermelho) favorita.

## Diferenças em relação à TV Android

- Sem troca de User-Agent: o navegador do webOS não deixa. Servidor IPTV que só aceita “VLC” pode recusar.
- Sem atualização automática dentro do app: na loja da LG quem atualiza é a própria loja.
- Guia completo (XMLTV) ainda não; só agora/a seguir das listas Xtream.
- Sem “Em alta” (Netflix/iTunes) nem capas de TMDB/TVMaze; as capas vêm da lista e do servidor Xtream.

## Compilar

```bash
npm ci
npm run build          # gera dist/
npx ares-package dist -o out
```

O GitHub Actions (`.github/workflows/webos.yml`) faz isso a cada push na `main` e publica o `.ipk`
na release `webos-latest`.

## Instalar na TV (teste)

1. Na TV, instale o app **Developer Mode** (LG Content Store), entre com uma conta LG de desenvolvedor
   (https://webostv.developer.lge.com) e ligue *Dev Mode Status* e *Key Server*. A sessão vale ~50 h; renove no app.
2. No PC (mesma rede):
   ```bash
   npx ares-setup-device        # adicione a TV: IP mostrado no Developer Mode, porta 9922
   npx ares-novacom --device tv --getkey   # digite a passphrase mostrada na TV
   npx ares-install --device tv NTPlay-webOS.ipk
   npx ares-launch --device tv com.natanael.ntplay
   ```
3. Para depurar: `npx ares-inspect --device tv --app com.natanael.ntplay --open`.

## Publicar na LG Content Store

Conta no **LG Seller Lounge** (https://seller.lgappstv.com), cadastro do app com o id `com.natanael.ntplay`,
envio do `.ipk`, ícones e capturas. A revisão da LG testa o app: informe uma **conta de teste com validade longa
e uma lista que funcione**, senão o app é recusado por não abrir. Política da LG para player IPTV: o app não pode
trazer nem divulgar listas/conteúdo; é o usuário quem adiciona a própria lista.

## Estrutura

| Arquivo | Função |
|---|---|
| `src/sync.js` | Conta e criptografia (mesmo protocolo do `Sync.kt`) |
| `src/state.js` | Listas, biblioteca, favoritos, grupos, progresso e sincronização (`AppState.kt`) |
| `src/library.js`, `src/util.js` | Leitura da M3U e classificação (`Library.kt`, `Util.kt`) |
| `src/xtream.js` | API Xtream (`Xtream.kt`) |
| `src/player.js` | Player e controles |
| `src/ui.js` | Telas |
| `src/nav.js` | Navegação por setas e Magic Remote |
| `src/futebol.js` | Aba Futebol |
| `src/presence.js` | Contador anônimo (mesmo do PC/TV, plataforma `webos`) |

Autor: Natanael G Silva.
