import React from 'react';

const Block = ({ className = '' }) => <div className={`bg-slate-200/80 rounded-xl animate-pulse ${className}`} />;

const ProductGrid = ({ count = 8 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="rounded-2xl bg-white p-3 space-y-3 border border-slate-100">
        <Block className="aspect-square w-full" />
        <Block className="h-4 w-4/5" />
        <Block className="h-3 w-2/5" />
        <Block className="h-8 w-full" />
      </div>
    ))}
  </div>
);

const PageHeader = () => (
  <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3">
    <Block className="h-9 w-9 rounded-full" />
    <Block className="h-6 w-36" />
  </div>
);

const HomeContent = () => (
  <div className="max-w-7xl mx-auto px-4 py-5 space-y-6">
    <Block className="h-36 sm:h-60 w-full rounded-3xl" />
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-2 shrink-0 w-16 sm:w-24">
          <Block className="aspect-square rounded-2xl" />
          <Block className="h-3 w-4/5 mx-auto" />
        </div>
      ))}
    </div>
    <Block className="h-6 w-44" />
    <ProductGrid count={8} />
  </div>
);

const Listing = ({ categories = false }) => (
  <>
    <PageHeader />
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
      <Block className="h-10 w-full rounded-2xl" />
      {categories && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {Array.from({ length: 8 }, (_, index) => <Block key={index} className="aspect-square rounded-2xl" />)}
        </div>
      )}
      <div className="flex gap-2">{['w-24', 'w-32', 'w-28'].map((width) => <Block key={width} className={`h-8 ${width}`} />)}</div>
      <ProductGrid />
    </div>
  </>
);

const Detail = () => (
  <>
    <PageHeader />
    <div className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
      <Block className="aspect-square w-full rounded-3xl" />
      <div className="space-y-5">
        <Block className="h-7 w-4/5" />
        <Block className="h-4 w-2/5" />
        <Block className="h-9 w-1/3" />
        <Block className="h-24 w-full" />
        <Block className="h-12 w-full" />
      </div>
    </div>
  </>
);

const Rows = ({ checkout = false }) => (
  <>
    <PageHeader />
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
      {Array.from({ length: checkout ? 3 : 4 }, (_, index) => (
        <div key={index} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-4">
          <Block className="h-20 w-20 shrink-0" />
          <div className="flex-1 space-y-3"><Block className="h-4 w-3/4" /><Block className="h-3 w-1/2" /><Block className="h-5 w-1/3" /></div>
        </div>
      ))}
      {checkout && <Block className="h-24 w-full rounded-2xl" />}
    </div>
  </>
);

const Profile = () => (
  <>
    <PageHeader />
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      <div className="bg-white p-4 rounded-2xl flex items-center gap-4"><Block className="h-14 w-14 rounded-full" /><Block className="h-5 w-40" /></div>
      <div className="grid grid-cols-4 gap-3 bg-white rounded-2xl p-4">{[0, 1, 2, 3].map((index) => <Block key={index} className="h-16 rounded-2xl" />)}</div>
      {[0, 1, 2].map((index) => <Block key={index} className="h-24 w-full rounded-2xl" />)}
    </div>
  </>
);

const Panel = ({ kind = 'dashboard' }) => (
  <div className="min-h-screen flex bg-slate-50">
    <div className="hidden md:block w-56 shrink-0 bg-slate-900 p-5 space-y-5">{Array.from({ length: 9 }, (_, index) => <Block key={index} className="h-9 w-full bg-slate-700/80" />)}</div>
    <div className="flex-1 p-4 sm:p-7 space-y-6">
      <Block className="h-10 w-52" />
      {kind === 'dashboard' && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((index) => <Block key={index} className="h-28" />)}</div>
        <Block className="h-64 w-full" />
        <Block className="h-48 w-full" />
      </>}
      {kind === 'table' && <>
        <div className="flex gap-3"><Block className="h-10 flex-1" /><Block className="h-10 w-28" /></div>
        <div className="bg-white rounded-2xl p-4 space-y-4">
          <Block className="h-10 w-full" />
          {Array.from({ length: 7 }, (_, index) => <Block key={index} className="h-14 w-full" />)}
        </div>
      </>}
      {kind === 'form' && <div className="bg-white rounded-2xl p-5 grid sm:grid-cols-2 gap-5">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="space-y-2"><Block className="h-4 w-24" /><Block className="h-11 w-full" /></div>)}
        <Block className="h-12 w-36" />
      </div>}
    </div>
  </div>
);

const PageSkeleton = ({ variant, className = '' }) => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isPanel = /^\/(admin|seller|warehouse|delivery)(\/|$)/.test(pathname);
  const kind = variant || (isPanel
    ? /\/(add|edit|settings|profile)(\/|$)/.test(pathname) ? 'form' : /\/(products|orders|categories|customers|sellers|warehouses|returns|transactions|history)(\/|$)/.test(pathname) ? 'table' : 'dashboard'
    : pathname === '/' ? 'home'
    : /^\/(product|kit)\//.test(pathname) || /^\/orders\//.test(pathname) ? 'detail'
    : pathname.startsWith('/checkout') || pathname.startsWith('/cart') || pathname.startsWith('/orders') || pathname.startsWith('/transactions') ? 'rows'
    : pathname.startsWith('/profile') || pathname.startsWith('/settings') || pathname.startsWith('/wallet') || pathname.startsWith('/addresses') ? 'profile'
    : pathname.startsWith('/category') || pathname.startsWith('/search') || pathname.startsWith('/offers') || pathname.startsWith('/shop-by-store') ? 'listing'
    : 'rows');

  return (
    <div role="status" aria-label="Loading page" className={`${kind === 'home-content' ? 'min-h-0' : 'min-h-screen'} bg-[#f1f4f8] ${className}`}>
      {kind === 'home' && <><PageHeader /><HomeContent /></>}
      {kind === 'home-content' && <HomeContent />}
      {kind === 'listing' && <Listing categories={pathname.startsWith('/categor')} />}
      {kind === 'detail' && <Detail />}
      {kind === 'rows' && <Rows checkout={pathname.startsWith('/checkout')} />}
      {kind === 'profile' && <Profile />}
      {(kind === 'dashboard' || kind === 'table' || kind === 'form') && <Panel kind={kind} />}
    </div>
  );
};

export default PageSkeleton;
