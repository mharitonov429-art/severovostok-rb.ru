# Северо-Восток РБ — severovostok-rb.ru

Статический справочник организаций Дуванского, Салаватского, Мечетлинского, Белокатайского и Кигинского районов.
Генератор без зависимостей (Node.js 18+), публикация на GitHub Pages.

## Как это устроено
- `data/Health.txt` — ваш файл с медицинскими организациями (источник правды).
- `scripts/parse-health.mjs` — превращает его в `data/organizations.json`. Запускайте после каждой правки Health.txt.
- `data/partners.json` — партнёры (4 основных со ссылками, остальные без ссылок).
- `data/site.json` — название, домен, счётчик Метрики, данные владельца.
- `content/pages.mjs` — шаблоны всех страниц. `content/stati/`, `content/novosti/` — Markdown-статьи и новости (формат в `_шаблон.md`).
- `build.mjs` — сборка в `dist/`: страницы, sitemap, llms.txt, ai-guide.txt, ai-catalog.json, webmcp.js, 404.
- `scripts/check.mjs` — проверка (то же, что делает GitHub перед публикацией).

## Команды
```bash
git pull                          # бот мог записать файл ротации
node scripts/parse-health.mjs     # если менялся Health.txt
node build.mjs                    # собрать
node scripts/check.mjs            # проверить
node scripts/serve.mjs            # http://localhost:8080
git add -A && git commit -m "Обновил данные" && git push
```

## Публикация
1. Создайте репозиторий (лучше проектный, не `mharitonov429-art.github.io`: у пользовательского репозитория может быть только один домен), загрузите содержимое папки.
2. Settings → Pages → Source: GitHub Actions. Custom domain: severovostok-rb.ru, включите Enforce HTTPS.
3. Файл `static/CNAME` уже есть. Проверьте, что файлы подтверждения Яндекса и Google в `static/` выданы именно для этого домена.

Что осталось доделать: `docs/ZAPOLNIT.md`. План SEO по этапам 1–5: `docs/SEO-PLAN.md`.
