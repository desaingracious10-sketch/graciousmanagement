import styles from './RoutePrintSheet.module.css'

export default function RoutePrintSheet({ routes }) {
  return (
    <>
      <div className={`no-print grid gap-5 ${styles.previewStack}`}>
        {routes.map((route, index) => (
          <section key={route.id} className={`${styles.routePage} ${styles.previewPage} ${index === 0 ? styles.firstPage : ''}`}>
            <RoutePage route={route} />
          </section>
        ))}
      </div>

      <div className={styles.printRoot}>
        {routes.map((route, index) => (
          <section key={route.id} className={`${styles.routePage} ${index === 0 ? styles.firstPage : ''}`}>
            <RoutePage route={route} />
          </section>
        ))}
      </div>
    </>
  )
}

function RoutePage({ route }) {
  return (
    <div className={styles.pageInner}>
      <header className={styles.routeHeader}>
        <div>
          {route.routeLabel} - {route.dayLabel} - {route.driverName} {route.deliveryCount}x - POINT {route.pointCount}
        </div>
        {route.zoneName ? <div className={styles.headerMeta}>Zona: {route.zoneName}</div> : null}
        {route.routeNotes ? <div className={styles.headerMeta}>Catatan rute: {route.routeNotes}</div> : null}
      </header>

      <table className={styles.routeTable}>
        <tbody>
          {route.rows.map((pair, index) => (
            <tr key={`${route.id}-row-${index}`}>
              <RouteCell entry={pair[0]} />
              <RouteCell entry={pair[1]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RouteCell({ entry }) {
  if (!entry) {
    return <td className={`${styles.routeCell} ${styles.emptyCell}`} />
  }

  return (
    <td className={`${styles.routeCell} ${entry.statusTone === 'habis' ? styles.statusHabis : ''} ${entry.statusTone === 'pindah_alamat' ? styles.statusPindah : ''}`}>
      <div className={styles.customerNumber}>{entry.statusLabel}</div>
      <div className={`${styles.customerName} ${entry.highlightProgram ? styles.programHighlight : ''}`}>
        {entry.customerName}
        {entry.showNewLabel ? ' (N)' : ''}
      </div>
      <div className={styles.customerProgram}>{entry.programText || '-'}</div>
      {entry.dietaryNotes ? <div className={styles.customerDiet}>{entry.dietaryNotes}</div> : null}
      {entry.requestNotes ? <div className={styles.customerRequest}>{entry.requestNotes}</div> : null}
      <div className={styles.customerPhone}>No. Hp: {entry.phone}</div>
      <div className={styles.customerAddress}>{entry.address}</div>
    </td>
  )
}
