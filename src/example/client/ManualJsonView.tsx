export const ManualJsonView = () => {
  const getData = () => {
    // return {
    //   objects: Array.from(database.objects.values()).filter(ref => ref.getObject()).map(ref => ref.getObject()!.frontend),
    // }
    return database.getRootObject()?.frontend ?? null
  }

  const [jsonView, setJsonView] = useState(JSON.stringify(getData(), null, 2));
  
  useEffect(() => {
    setInterval(() => {
      setJsonView(JSON.stringify(getData(), null, 2))
    }, 500)
  })

  return <pre style={{ minHeight: 400, display: 'block', flex: 1 }}>{jsonView}</pre>
}