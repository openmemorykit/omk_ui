export default {
  meta: { type: 'suggestion', schema: [], messages: { comment: 'Pas de commentaire HTML dans un gabarit.' } },
  create(context) {
    const fragment = context.sourceCode.parserServices?.getDocumentFragment?.()
    return {
      Program() {
        const comments = fragment?.comments ?? []
        comments
          .filter((comment) => comment.type === 'HTMLComment' || comment.type === 'HTMLBogusComment')
          .forEach((comment) => context.report({ loc: comment.loc, messageId: 'comment' }))
      },
    }
  },
}
