# Vetka Desktop

Локальное Windows-приложение для работы с куклами Amazon, историей цен и заказами.

## Запуск для разработки

```powershell
npm install
npm start
```

## Проверка и установщик

```powershell
npm test
npm run typecheck
npm run lint
npm run make
```

Данные хранятся в каталоге Electron `userData`: база `vetka.sqlite`, резервные копии в `backups`, профили Amazon в `amazon-profiles`.
