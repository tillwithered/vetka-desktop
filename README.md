# Vetka Desktop

Локальное Windows-приложение для ежедневной работы Vetka Dolls: каталог актуальных кукол Amazon, история региональных цен, избранное, расчёт доставки и ведение заказов по контакту клиента.

## Что важно

- Приложение полноценно работает с локальной SQLite-базой и не требует отдельного сервера.
- Amazon-проверки используют установленный Microsoft Edge и отдельные локальные профили по регионам.
- Заказы, контакты клиентов, база цен и настройки остаются только на компьютере пользователя.
- Публичный репозиторий содержит исходный код, но не содержит рабочие данные.

## Установка и обновления

Windows-установщик публикуется в [GitHub Releases](https://github.com/tillwithered/vetka-desktop/releases) под именем `VetkaDesktopSetup.exe`.

V0 пока не подписан коммерческим сертификатом, поэтому Windows SmartScreen может показать предупреждение о неизвестном издателе. Проверить загруженный файл можно по `SHA256SUMS.txt` и GitHub build provenance в том же релизе.

После первой установки Vetka Desktop при запуске проверяет новые публичные релизы. Обновление загружается в фоне, но приложение перезапускается только после нажатия `Перезапустить сейчас`; кнопка `Позже` оставляет установку до следующего обычного запуска.

Если GitHub или интернет недоступен, приложение продолжает работать с локальными данными. Проверка повторится при следующем запуске или ручном запросе.

## Локальные данные

Electron хранит рабочие данные в системном каталоге `userData`:

- `vetka.sqlite` — куклы, цены, настройки, заказы и контакты;
- `backups/` — локальные резервные копии базы;
- `amazon-profiles/` — браузерные профили регионов Amazon.

Эти пути, `.env`, `node_modules`, `.vite` и `out` исключены из Git и release-артефактов. Обновление приложения не меняет каталог `userData` и не удаляет базу.

## Разработка

Требуются Windows, Node.js 22 и Microsoft Edge.

```powershell
cd apps/desktop
npm ci
npm start
```

Полная локальная проверка:

```powershell
npm test
npm run typecheck
npm run lint
npm run package
npm run make
```

Готовые Squirrel.Windows-файлы появляются в `apps/desktop/out/make/squirrel.windows/x64/`.

## Выпуск версии

Релиз создаётся только из стабильного semver-тега, который точно совпадает с `apps/desktop/package.json`:

```powershell
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release 1.0.1"
git tag -a v1.0.1 -m "Vetka Desktop v1.0.1"
git push origin main
git push origin v1.0.1
```

Workflow повторно запускает тесты, typecheck и lint, собирает Squirrel.Windows, создаёт SHA-256 checksums и provenance, а затем публикует `RELEASES`, полный `.nupkg`, `VetkaDesktopSetup.exe` и `SHA256SUMS.txt`. Personal access token не используется — публикация работает через короткоживущий `GITHUB_TOKEN` с минимальными permissions.

## Безопасность

Renderer работает с sandbox и context isolation, без Node integration. Preload открывает только типизированные операции приложения; URL update-feed нельзя изменить из интерфейса. Установка разрешена только после реального события `update-downloaded`.

Следующий этап усиления перед широким распространением — подпись Windows installer и бинарников сертификатом code signing через защищённый GitHub environment. Протокол автообновлений и пользовательский сценарий при этом менять не потребуется.

## Лицензия

[MIT](LICENSE)
