// ============================================================
// Curso Interactivo GitHub — script.js
// Inicializa Mermaid con la paleta IEEE sobria.
// ============================================================

if (typeof mermaid !== 'undefined') {
  mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    themeVariables: {
      primaryColor:       '#E8EEF7',
      primaryBorderColor: '#1F3A68',
      primaryTextColor:   '#1F1F1F',
      lineColor:          '#4A4A4A',
      secondaryColor:     '#F5F5F5',
      tertiaryColor:      '#FFF4E5',
      actorBkg:           '#1F3A68',
      actorTextColor:     '#FFFFFF',
      actorBorder:        '#0F1F3D',
      signalColor:        '#1F3A68',
      signalTextColor:    '#1F1F1F',
      noteBkgColor:       '#FFF4E5',
      noteBorderColor:    '#B86E00',
      noteTextColor:      '#1F1F1F',
      labelBoxBkgColor:   '#E8EEF7',
      labelBoxBorderColor:'#1F3A68',
      fontFamily:         'Helvetica Neue, Arial, sans-serif',
      git0:               '#1F3A68',
      git1:               '#B86E00',
      git2:               '#1B5E20',
      git3:               '#8B1A1A',
      gitBranchLabel0:    '#FFFFFF',
      gitBranchLabel1:    '#FFFFFF',
      gitBranchLabel2:    '#FFFFFF',
      gitBranchLabel3:    '#FFFFFF',
      commitLabelColor:   '#1F1F1F',
      commitLabelBackground: '#FFFFFF'
    },
    flowchart: { curve: 'basis', useMaxWidth: true },
    sequence:  { useMaxWidth: true, mirrorActors: false },
    gitGraph:  { showCommitLabel: true, mainBranchName: 'main' }
  });
}
