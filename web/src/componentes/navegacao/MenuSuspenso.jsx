import { useMenuSuspenso } from './useMenuSuspenso.js'

// Item do menu principal que abre um painel por cima do conteúdo (sem empurrar a página).
// id: base dos ids (aria-controls); ativo: a página atual está nesta seção (sublinhado);
// children(fechar): o conteúdo do painel, que recebe a função de fechar (para fechar ao escolher um item).
export default function MenuSuspenso({ id, rotulo, ativo, largo = false, classe = '', children }) {
  const m = useMenuSuspenso()
  return (
    <div className="menu-suspenso" ref={m.raiz}>
      <button ref={m.botao} type="button" className="barra-item" id={`${id}-botao`} aria-expanded={m.aberto} aria-controls={`${id}-painel`}
        aria-current={ativo ? 'page' : undefined} onClick={m.alternar} onKeyDown={m.teclaNoBotao}>
        {rotulo} <span className="seta" aria-hidden="true">▾</span>
      </button>
      <div ref={m.painel} id={`${id}-painel`} className={`painel-suspenso${largo ? ' largo' : ''}${classe ? ` ${classe}` : ''}`} hidden={!m.aberto}
        role="region" aria-labelledby={`${id}-botao`} onKeyDown={m.teclaNoPainel}>
        {children(() => m.fechar())}
      </div>
    </div>
  )
}
