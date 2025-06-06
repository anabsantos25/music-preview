//a api do deezer nao inclui nos headers a permissão pro domínio acessar diretamente os dados da pi
//ao tentar acessar direto via fetch('https://api.deezer.com/...') retorna um erro do CORS bloqueando a requisicao
const proxy = 'https://corsproxy.io/?'; //url do proxy

//mapeia alguns generos musicais escolhidos, ids de acordo com a api do deezer
const generos = {
  pop: 132,
  rock: 152,
  rap: 116,
  electro: 106,
  jazz: 129,
  soul: 167
};

//o proxy faz a requisição para a API, recebe a resposta, e entao repassa os headers adequados para liberar o acesso
async function fetchDeezer(apiUrl) {
  try {
    const response = await fetch(`${proxy}${apiUrl}`);
    if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
    return null;
  }
}

//usar fetch permite que o programa faça a requisição de forma assíncrona, sem travar a interface do usuário. ela retorna uma promise, porque a requisicao demora para responder (HTTP)
//async eh colocada antes da declaração de uma função para dizer que ela vai lidar com operacoes assincronas. ela sempre retorna uma promise resolvida, podendo usar await pra esperar a promise se resolver
//consts nao podem ser reatribuidas depois de definidas

//funcao do botao de voltar
//function botaoVoltar() {
//  return `<button class="btn btn-secondary mb-3" onclick="buscarTudo()">Voltar</button>`;
//}

//seleciona todos os elementos <audio> da página
function configurarFadeNosAudios() {
  const audios = document.querySelectorAll('audio');

  //todos os audios comecam com volume 0 pra dar o efeito de fade-in
  audios.forEach(audio => {
    audio.volume = 0;

    //variaveis para controlar os intervalos do fade-in e fade-out
    let fadeInInterval = null;
    let fadeOutInterval = null;

    //funcao que aumenta gradualmente o volume ate 1 (fade-in)
    const fadeIn = () => {
      clearInterval(fadeOutInterval);
      fadeInInterval = setInterval(() => {
        if (audio.volume < 1) {
          audio.volume = Math.min(audio.volume + 0.05, 1);
        } else {
          clearInterval(fadeInInterval);
        }
      }, 100);
    };

    //funcao que reduz o volume ate 0 e pausa o áudio (fade-out)
    const fadeOutAndPause = () => {
      clearInterval(fadeInInterval);
      fadeOutInterval = setInterval(() => {
        if (audio.volume > 0.05) {
          audio.volume = Math.max(audio.volume - 0.07, 0);
        } else {
          //quando o volume estiver praticamente zero, pausa o audio e limpa o intervalo
          clearInterval(fadeOutInterval);
          audio.volume = 0;
          if (!audio.paused) audio.pause();
        }
      }, 100);
    };

    // quando o audio começa a tocar
    audio.addEventListener('play', () => {
      audios.forEach(other => {
        if (other !== audio && !other.paused) {
          //para todos os outros audios que estejam tocando, aplica fade-out e pausa
          fadeOutAndPause.call(other);
        }
      });

      //aplica o fade-in no audio que começou a tocar
      fadeIn();
    });

    //durante a reproducao, verifica se faltam menos de 3 segundos para acabar
    audio.addEventListener('timeupdate', () => {
      if (audio.duration && (audio.duration - audio.currentTime) <= 3 && !audio.paused) {
        fadeOutAndPause();
      }
    });

    //quando o audio termina, limpa intervalos e zera volume
    audio.addEventListener('ended', () => {
      clearInterval(fadeInInterval);
      clearInterval(fadeOutInterval);
      audio.volume = 0;
    });
  });
}

//pega o termo digitado no input e remove espaços extras no comeco/fim
async function buscarTudo() {
  const termo = document.getElementById('inputBusca').value.trim();
  const resultado = document.getElementById('resultadoBusca');
  resultado.innerHTML = '';  //limpa resultados anteriores antes de fazer uma nova busca

  //se nao tiver termo digitado, exibe mensagem e sai da funcao
  if (!termo) {
    resultado.innerText = 'Digite algo para buscar.';
    return;
  }

  //codifica o termo para ser usado em URL (escapa caracteres especiais)
  const encodedTermo = encodeURIComponent(termo);

  //faz as tres buscas em paralelo usando promise.all
  //funcao principal que faz busca geral por artistas, albuns e musicas com termos semelhantes a pesquisa
  const [artistasData, albunsData, musicasData] = await Promise.all([
    fetchDeezer(`https://api.deezer.com/search/artist?q=${encodedTermo}`),
    fetchDeezer(`https://api.deezer.com/search/album?q=${encodedTermo}`),
    fetchDeezer(`https://api.deezer.com/search/track?q=${encodedTermo}`)
  ]);

  //ARTISTAS
  if (artistasData?.data?.length) {
    let htmlArtistas = '<h3>Artistas encontrados:</h3><div class="lista-musicas grid-resultados">';

    //para cada artista encontrado, busca numero de fas
    const detalhesArtistas = await Promise.all(
      artistasData.data.map(async artista => {
        const detalhes = await fetchDeezer(`https://api.deezer.com/artist/${artista.id}`);
        return {
          ...artista,
          fans: detalhes?.nb_fan ?? 0 //usa 0 se nao tiver resultado de fas
        };
        })
      );

    detalhesArtistas.forEach(artista => {
      const nomeEscapado = artista.name.replace(/'/g, "\\'");
      htmlArtistas += `
        <div class="album-item" onclick="buscarAlbunsDoArtista(${artista.id}, '${nomeEscapado}')">
          <img src="${artista.picture_medium}" alt="${artista.name}" />
          <strong>${artista.name}</strong>
          <p>${artista.fans.toLocaleString('pt-BR')} fãs</p>
        </div>`;
    });

    htmlArtistas += '</div>';
    resultado.innerHTML += htmlArtistas;
  }

  // ÁLBUNS
  if (albunsData?.data?.length) {
    let htmlAlbuns = '<h3>Álbuns encontrados:</h3><div class="lista-musicas grid-resultados">';
    albunsData.data.forEach(album => {
      const tituloEscapado = album.title.replace(/'/g, "\\'");
      htmlAlbuns += `
        <div class="album-item" onclick="buscarMusicasDoAlbum(${album.id}, '${tituloEscapado}')">
          <img src="${album.cover_medium}" alt="${album.title}" />
          <p><strong>${album.title}</strong><br/>${album.artist.name}</p>
        </div>`;
    });
    htmlAlbuns += '</div>';
    resultado.innerHTML += htmlAlbuns;
  }

  // MÚSICAS
  if (musicasData?.data?.length) {
    let htmlMusicas = '<h3>Músicas encontradas:</h3><div class="lista-musicas grid-resultados">';
    musicasData.data.forEach(musica => {
      htmlMusicas += `
        <div class="album-item">
          <img src="${musica.album.cover_medium}" alt="${musica.title}" />
          <p><strong>${musica.title}</strong><br/>${musica.artist.name}</p>
          <audio controls src="${musica.preview}"></audio>
        </div>`;
    });
    htmlMusicas += '</div>';
    resultado.innerHTML += htmlMusicas;
  }

  //innerHTML: monta o HTML para cada artista, com imagem, nome e numero de fas. tambem monta os albuns e musicas

  //se nenhuma categoria retornou resultado, mostra mensagem de "nenhum resultado"
  if (
    !(artistasData?.data?.length || albunsData?.data?.length || musicasData?.data?.length)
  ) {
    resultado.innerText = 'Nenhum resultado encontrado.';
  }

  //chama a funcao que adiciona efeito fade nos elementos <audio> da pagina
  configurarFadeNosAudios();
}

//funcao assincrona que busca e exibe os albuns de um artista pelo ID e nome
async function buscarAlbunsDoArtista(artistaId, artistaNome) {
//seleciona o elemento onde os resultados da busca serão mostrados
  const resultado = document.getElementById('resultadoBusca');
  //limpa a busca e titulo do album
  resultado.innerHTML = ('') + `<h3>Albuns de "${artistaNome}":</h3>`;

  //faz a requisição para a API do Deezer buscando os albuns do artista
  const data = await fetchDeezer(`https://api.deezer.com/artist/${artistaId}/albums`);

  //se nao houver albuns, informa ao usuario e retorna para nao continuar
  if (!data?.data?.length) {
    resultado.innerHTML += `<p>Nenhum álbum encontrado para ${artistaNome}.</p>`;
    return;
  }

  //monta o HTML para mostrar a lista de albuns em formato de grid
  let html = '<div class="lista-musicas grid-resultados">';
  data.data.forEach(album => {
    //escapa aspas simples para evitar erros no onclick
    const tituloEscapado = album.title.replace(/'/g, "\\'");
    //adiciona cada álbum como um item clicavel
    html += `
      <div class="album-item" onclick="buscarMusicasDoAlbum(${album.id}, '${tituloEscapado}')">
        <img src="${album.cover_medium}" alt="${album.title}" />
        <p><strong>${album.title}</strong></p>
      </div>`;
  });
  html += '</div>';

  //insere o HTML da lista de albuns dentro do resultado
  resultado.innerHTML += html;
}

//funcao assincrona que busca e exibe as musicas de um album
async function buscarMusicasDoAlbum(albumId, albumTitulo) {
  const resultado = document.getElementById('resultadoBusca');
  
  //limpa a busca e titulo da musica
  resultado.innerHTML = ('') + `<h3>Músicas do álbum "${albumTitulo}":</h3>`;

  //busca os dados do album na API do Deezer
  const data = await fetchDeezer(`https://api.deezer.com/album/${albumId}`);

  //se nao houver musicas, informa e sai da funcao
  if (!data?.tracks?.data?.length) {
    resultado.innerHTML += `<p>Nenhuma música encontrada no álbum "${albumTitulo}".</p>`;
    return;
  }

  //monta o HTML para mostrar a lista das musicas
  let html = '<div class="lista-musicas grid-resultados">';
  data.tracks.data.forEach(musica => {
    html += `
      <div class="album-item">
        <img src="${data.cover_medium}" alt="${musica.title}" />
        <p><strong>${musica.title}</strong><br/>${musica.artist.name}</p>
        <audio controls src="${musica.preview}"></audio>
      </div>`;
  });
  html += '</div>';

  //insere o HTML das musicas no resultado
  resultado.innerHTML += html;

  //configura os efeitos de fade nos players de áudio recém inseridos
  configurarFadeNosAudios();
}

//funcao assincrona que carrega musicas populares por genero musical
async function carregarMusicasPorGenero(genreId, container) {
  //exibe mensagem temporaria enquanto carrega
  container.innerHTML = 'Carregando músicas...';

  //busca artistas daquele genero na API
  const data = await fetchDeezer(`https://api.deezer.com/genre/${genreId}/artists`);

  //se não houver artistas (por algum erro na requisicao), mostra mensagem e retorna
  if (!data?.data?.length) {
    container.innerHTML = '<p>Nenhum artista encontrado neste gênero.</p>';
    return;
  }

  //seleciona ate 4 artistas para limitar a busca
  const artistas = data.data.slice(0, 4);
  let musicas = [];

  //para cada artista, busca as 5 musicas mais populares
  for (const artista of artistas) {
    const top = await fetchDeezer(`https://api.deezer.com/artist/${artista.id}/top?limit=5`);
    if (top?.data?.length) {
      // Adiciona essas músicas ao array geral
      musicas = musicas.concat(top.data);
    }
  }

  //se nao encontrou nenhuma musica, avisa e retorna (erro de requisicao)
  if (!musicas.length) {
    container.innerHTML = '<p>Nenhuma música encontrada para este gênero.</p>';
    return;
  }

  //monta o HTML com a lista das musicas encontradas
  let html = '<div class="lista-musicas grid-resultados">';
  musicas.forEach(musica => {
    html += `
      <div class="album-item">
        <img src="${musica.album.cover_medium}" alt="${musica.title}" />
        <p><strong>${musica.title}</strong><br/>${musica.artist.name}</p>
        <audio controls src="${musica.preview}"></audio>
      </div>`;
  });
  html += '</div>';

  //insere o HTML no container informado
  container.innerHTML = html;

  //aplica efeito de fade nos áudios carregados
  configurarFadeNosAudios();
}

//quando o contedo da pagina estiver totalmente carregado
document.addEventListener('DOMContentLoaded', () => {
  //adiciona o evento de clique no botao de busca para chamar a função buscarTudo
  document.getElementById('btnBuscar').addEventListener('click', buscarTudo);

  //seleciona todos os botoes de aba de genero musical
  const tabs = document.querySelectorAll('#generoTabs button[data-bs-toggle="tab"]');

  //para cada aba, adiciona evento que carrega as musicas daquele genero quando a aba eh mostrada
  tabs.forEach(tab => {
    tab.addEventListener('shown.bs.tab', async (event) => {
      //pega a chave do gênero a partir do id da aba
      const generoKey = event.target.id.replace('-tab', '');
      //pega o id do genero baseado no objeto generos
      const generoId = generos[generoKey];
      //seleciona o conteudo da aba ativa
      const tabPane = document.querySelector(event.target.getAttribute('data-bs-target'));
      const container = tabPane.querySelector('.lista-musicas');

      //se o container da lista estiver vazio, carrega as músicas daquele gênero
      if (container && container.innerHTML.trim() === '') {
        await carregarMusicasPorGenero(generoId, container);
      }
    });
  });

  //carrega automaticamente o genero da aba ativa no carregamento da pagina
  const activeTab = document.querySelector('#generoTabs button.active');
  if (activeTab) {
    const generoKey = activeTab.id.replace('-tab', '');
    const generoId = generos[generoKey];
    const tabPane = document.querySelector(activeTab.getAttribute('data-bs-target'));
    const container = tabPane.querySelector('.lista-musicas');
    if (container) {
      carregarMusicasPorGenero(generoId, container);
    }
  }
});
