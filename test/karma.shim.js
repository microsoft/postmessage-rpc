const importAll = ctx => ctx.keys().forEach(ctx);
importAll(require.context('../src', true, /\.test\.ts/));
