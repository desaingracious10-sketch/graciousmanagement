export default function PagePlaceholder({ title, description }) {
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-gracious-navy">{title}</h1>
          {description && <p className="text-sm text-slate-600 mt-2">{description}</p>}
          <div className="mt-6 inline-block bg-teal/10 text-teal-dark text-sm font-medium px-4 py-2 rounded-lg">
            Halaman ini akan dibangun di PROMPT berikutnya.
          </div>
        </div>
      </div>
    </div>
  )
}
