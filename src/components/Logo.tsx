export function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={'logo' + (big ? ' big' : '')}>
      <img src="/icon.svg" alt="" />
      <span>
        Efecti<b>Gana</b>
      </span>
    </div>
  )
}
