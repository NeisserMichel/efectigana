export function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={'logo' + (big ? ' big' : '')}>
      <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" />
      <span>
        Efecti<b>Gana</b>
      </span>
    </div>
  )
}
