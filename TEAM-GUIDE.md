# WS Workspace — Руководство для команды

> Форк Craft Agents, адаптированный для W&S Agency.
> Репозиторий: https://github.com/W-S-Agency/ws-workspace

---

## 1. Установка для коллег

### Требования
- **Windows**: Git for Windows (bash.exe), Bun 1.3+
- **macOS**: Git, Bun 1.3+
- Claude Max/Pro подписка (OAuth токен)

### Шаги установки

```bash
# 1. Клонировать репозиторий
git clone https://github.com/W-S-Agency/ws-workspace.git
cd ws-workspace

# 2. Установить зависимости (postinstall автоматически пропатчит SDK)
bun install
# Вы увидите: [patch-sdk] Patched cli.js: ...

# 3. Запустить в dev-режиме
bun run electron:dev

# ИЛИ собрать установочный файл:
# Windows:
bun run electron:dist:win
# macOS:
bun run electron:dist:mac
# Linux:
bun run electron:dist:linux
```

Установочный файл появится в `apps/electron/dist/`.

### Первый запуск
1. Открыть WS Workspace
2. Settings → выбрать "Claude Pro/Max"
3. Авторизоваться через браузер (OAuth)
4. Готово — можно работать

### Если на Windows ошибка с bash.exe
Обычно `postinstall` скрипт всё исправляет автоматически. Если нет:
```bash
# Проверить что Git Bash установлен
ls "C:\Program Files\Git\bin\bash.exe"

# Или задать путь вручную (в системных переменных)
set CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe
```

---

## 2. Обновления от Craft Agents (upstream)

### Как получить обновления

```bash
cd ws-workspace

# Получить изменения из оригинального репо
git fetch upstream

# Посмотреть что изменилось
git log upstream/main --oneline -10

# Влить обновления
git merge upstream/main
# Или через rebase (чище история):
git rebase upstream/main
```

### Возможные конфликты

При мерже конфликты будут **только в файлах, которые мы изменили**:

| Наш файл | Что мы меняли | Вероятность конфликта |
|----------|---------------|---------------------|
| `package.json` | Добавили postinstall, переименовали | Средняя (если добавят новые скрипты рядом) |
| `packages/shared/src/agent/options.ts` | Windows env fix блок | Низкая (наш блок отдельный) |
| `packages/shared/src/network-interceptor.ts` | Windows env cleanup в начале файла | Низкая |
| `apps/electron/electron-builder.yml` | Переименовали продукт | Средняя (если изменят build config) |
| Все файлы с ребрендингом | "Craft Agents" → "WS Workspace" | Высокая в UI-строках |

### Как решать конфликты

```bash
# После git merge upstream/main, если есть конфликты:

# 1. Посмотреть какие файлы в конфликте
git status

# 2. Для каждого файла — открыть и разрешить
# Наше правило: берём ИХ код + наш ребрендинг
# То есть: функциональность от upstream, названия наши

# 3. После разрешения
git add <файлы>
git commit -m "Merge upstream/main: <описание обновления>"

# 4. Postinstall автоматически пропатчит новый cli.js
bun install
```

### Что НЕ вызовет конфликтов
- Новые файлы от upstream (добавятся без проблем)
- Изменения в файлах, которые мы не трогали (90% кодовой базы)
- Обновления зависимостей в package.json (мержатся автоматически)
- Обновления SDK (`cli.js`) — postinstall скрипт пропатчит автоматически

---

## 3. Наши доработки и обновления

### Как вносить изменения

```bash
# 1. Создать ветку для своей доработки
git checkout -b feature/my-feature

# 2. Внести изменения, протестировать
bun run electron:dev

# 3. Закоммитить и запушить
git add <файлы>
git commit -m "feat: описание доработки"
git push origin feature/my-feature

# 4. Создать Pull Request на GitHub
gh pr create --title "Описание" --body "Что сделано"

# 5. После ревью — влить в main
```

### Как обновить у коллег

**Вариант A — Dev-режим (разработчики):**
```bash
cd ws-workspace
git pull origin main
bun install    # postinstall пропатчит SDK если обновился
```

**Вариант B — Собранный билд (все остальные):**
```bash
# На машине где собираем:
cd ws-workspace
git pull origin main
bun install
bun run electron:dist:win   # или :mac / :linux

# Раздать файл из apps/electron/dist/ коллегам
# Они просто запускают установщик поверх старой версии
```

**Вариант C — Автообновления (будущее):**
Можно настроить свой update-сервер (S3/GitHub Releases),
тогда приложение будет обновляться само.

### Структура веток

```
main                  ← стабильная версия для всех
├── feature/*         ← новые фичи
├── fix/*             ← багфиксы
└── upstream-sync/*   ← мерж обновлений от Craft Agents
```

### Правила для команды

1. **Никогда не пушить напрямую в main** — только через PR
2. **Перед мержем upstream** — создавать отдельную ветку `upstream-sync/YYYY-MM-DD`
3. **Тестировать после мержа** — `bun run electron:dev`, проверить что работает
4. **Не менять TRADEMARK.md и LICENSE** — это юридические документы оригинала

### Полезные команды

```bash
# Запуск в dev-режиме
bun run electron:dev

# Сборка для Windows
bun run electron:dist:win

# Проверка типов
bun run typecheck

# Тесты
bun test

# Применить SDK-патч вручную (если нужно)
bun run scripts/patch-sdk-windows.ts

# Посмотреть лог изменений от upstream
git log upstream/main --oneline -20

# Сравнить нашу версию с upstream
git diff main upstream/main --stat
```

---

## 4. Автообновления (для нетехнических коллег)

Приложение обновляется автоматически через GitHub Releases. Коллегам не нужно ничего делать — при запуске приложение само проверяет наличие обновлений.

### Как это работает для коллег
1. Открывают WS Workspace как обычно
2. Если есть обновление — приложение скачает его в фоне
3. При следующем перезапуске — обновление установится автоматически
4. Или в меню появится "Install Update..." для немедленной установки

### Как выпустить обновление (для разработчика)

```bash
cd ws-workspace
git pull origin main

# 1. Обновить версию в package.json
# apps/electron/package.json → "version": "0.4.0"

# 2. Собрать
bun install
bun run electron:dist:win    # и/или :mac, :linux

# 3. Создать GitHub Release с артефактами
gh release create v0.4.0 \
  "apps/electron/release/WS-Workspace-x64.exe" \
  "apps/electron/release/latest.yml" \
  --title "v0.4.0" \
  --notes "Описание изменений"
```

**Важно**: в Release должны быть загружены:
- `WS-Workspace-x64.exe` (Windows)
- `latest.yml` (манифест для electron-updater)
- `WS-Workspace-arm64.dmg` и `latest-mac.yml` (macOS, если нужно)

После этого все установленные копии подхватят обновление автоматически.

### Первая установка коллегам

Для первой установки нужно вручную передать файл:
1. Собрать билд: `bun run electron:dist:win`
2. Файл `WS-Workspace-x64.exe` из `apps/electron/release/`
3. Отправить коллеге (Slack, email, облако)
4. Коллега запускает .exe → устанавливается в `%LOCALAPPDATA%\Programs\`
5. Все дальнейшие обновления — автоматически через GitHub Releases

---

## Контакты

- Репозиторий: https://github.com/W-S-Agency/ws-workspace
- Upstream: https://github.com/lukilabs/craft-agents-oss
- Вопросы: через Issues в нашем репозитории
