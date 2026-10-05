# Finanças

App pessoal de controle de dinheiro. PWA em HTML/CSS/JS puro, sem build e sem dependências.
Os dados ficam só no celular (localStorage do navegador). Nada vai pra internet.

## O que faz

- **Início:** patrimônio total com a variação no período e gráfico de evolução (7D, 1M, 3M, 6M,
  1A, Tudo), ações rápidas (entrada, saída, investir, nova meta), dica do momento, dinheiro
  disponível, investimentos, rendimentos, a receber, resumo do mês, movimentações e metas
- **Movimentações:** extrato do mês por dia, com busca e filtros
- **Investimentos:** total investido, rentabilidade, rendimentos, evolução e distribuição por tipo;
  aporte (disponível -> investido), resgate (volta) e rendimento (cresce o patrimônio)
- **Metas:** guardar/retirar, prazo, quanto por mês falta, animação ao concluir
- **Relatórios:** resumo do mês, entradas x saídas (6 meses), para onde foi o dinheiro e orçamento
- **Configurações:** tema, patrimônio inicial, contas fixas, categorias, backup
- Contas fixas: "Repetir todo mês" cria o lançamento sozinho; data futura aparece como prevista
  e só entra no saldo quando o dia chegar
- Celular: barra inferior flutuante. Computador: barra lateral. Funciona offline.

## Rodar no PC (pra testar)

```
node servidor.js
```

Abrir http://localhost:8080

## Rodar no iPhone (localhost)

1. Instalar o **a-Shell** (App Store, grátis — terminal com Python embutido)
2. Mandar a pasta `financas` pro iPhone (zip pelo iCloud Drive, WhatsApp ou e-mail pra você
   mesmo) e descompactar no app **Arquivos**
3. No a-Shell:
   ```
   pickFolder
   ```
   escolher a pasta `financas`, depois:
   ```
   python3 -m http.server 8080
   ```
4. Sem fechar o a-Shell, ir pro **Safari** e abrir `http://localhost:8080`
5. Compartilhar → **Adicionar à Tela de Início**
6. **Abrir o app pela tela de início uma vez com o servidor ainda ligado** (o app instalado
   tem armazenamento separado do Safari e precisa baixar os arquivos uma vez)

O iOS pausa o a-Shell quando ele fica em segundo plano. Se o Safari não carregar, volte pro
a-Shell, rode o comando de novo e troque de app rápido. Depois do passo 6 o app abre sozinho,
sem servidor.

Use sempre pelo ícone da tela de início, não pela aba do Safari: os dados são separados, e o
iOS pode apagar os dados de sites abertos no Safari depois de 7 dias sem uso. O app instalado
não sofre essa limpeza.

## Rodar no celular Android (localhost)

1. Instalar o **Termux** pelo F-Droid (a versão da Play Store está desatualizada)
2. No Termux:
   ```
   pkg update
   pkg install python
   termux-setup-storage
   ```
3. Copiar a pasta `financas` pro celular (ex.: pra `Download/financas`)
4. No Termux:
   ```
   cd ~/storage/downloads/financas
   python -m http.server 8080
   ```
   (ou `pkg install nodejs` e `node servidor.js`)
5. No Chrome do celular abrir `http://localhost:8080`
6. Menu do Chrome → **Adicionar à tela inicial / Instalar app**

Depois de instalado, o app abre e funciona **mesmo com o Termux fechado**: o service worker
guarda tudo em cache. O servidor só precisa estar ligado pra instalar e pra receber atualizações.

## Cuidados com os dados

- Os dados ficam presos ao endereço `localhost:8080`. **Use sempre a mesma porta**: em outra
  porta o app abre vazio.
- Apagar o app da tela de início (iPhone) ou limpar os dados do Chrome (Android) apaga tudo.
  Use **Ajustes → Exportar** de vez em quando: no iPhone abre a folha de compartilhar, escolha
  "Salvar em Arquivos" ou mande pra você mesmo.
- Pra trocar de celular: exportar no antigo, importar no novo.

## Atualizar o app

Ao mudar qualquer arquivo, subir a versão em `sw.js` (`financas-v1` → `financas-v2`).
Com o servidor ligado, abrir o app duas vezes: a primeira baixa a versão nova, a segunda já usa.

## Logo e ícones

A logo (Syncy) e os ícones são gerados a partir de `identidade/syncy/gerar.js`. Pra mudar:

```
node ../identidade/syncy/gerar.js
sh ../identidade/syncy/render-png.sh
```

O primeiro gera `logo.svg` e `icon.svg`, o segundo os PNGs (`icon-192`, `icon-512`,
`icon-maskable-512`, `apple-touch-icon`). Depois subir a versão em `sw.js`.
